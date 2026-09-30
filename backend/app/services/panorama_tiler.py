"""
Panorama tiling pipeline for the Virtual Tour module.

Takes a full-resolution equirectangular panorama and slices it into a multi-level
tile pyramid, exactly like Google Maps tiles — visitors only download the tiles
currently in view at the resolution their current zoom level needs.

Requires: pyvips (pip install pyvips) + libvips system package
  sudo apt-get install libvips libvips-dev
  pip install pyvips
"""

import os
import json
import math
import logging
import threading
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

TILE_SIZE = 512       # pixels per tile
JPEG_QUALITY = 88     # JPEG quality for tiles (good balance of quality/size)

# Levels to generate: (width, height) for each zoom level
# Level 0 = tiny preview, Level 4 = full/near-full resolution
LEVEL_SIZES = [
    (512, 256),      # level 0 — tiny preview / thumbnail
    (1024, 512),     # level 1 — low zoom
    (2048, 1024),    # level 2 — medium zoom
    (4096, 2048),    # level 3 — high zoom
    (8192, 4096),    # level 4 — max resolution (skip if original smaller)
]


def _try_import_pyvips():
    """Lazy import pyvips so startup doesn't fail if not installed."""
    try:
        import pyvips
        return pyvips
    except (ImportError, Exception) as e:
        logger.warning(f"pyvips not available: {e}. Panorama tiling disabled.")
        return None


def tile_panorama(file_path: str, node_id: int):
    """
    Generate a tile pyramid for the given equirectangular panorama.
    Updates the TourNode DB record when done.
    This function is designed to be called in a background thread.

    Args:
        file_path: Absolute path to the uploaded panorama image.
        node_id: ID of the TourNode to update on completion.
    """
    pyvips = _try_import_pyvips()

    # Import here to avoid circular imports (called from route context)
    from app.extensions import db
    from app.models.tour import TourNode

    # We need an application context since this runs in a background thread
    from flask import current_app
    app = current_app._get_current_object()

    with app.app_context():
        node = db.session.get(TourNode, node_id)
        if not node:
            logger.error(f"TourNode {node_id} not found for tiling")
            return

        node.tile_status = 'processing'
        db.session.commit()

        try:
            if pyvips is None:
                raise RuntimeError("pyvips not available")

            # Determine output directory
            uploads_dir = os.path.join(os.getcwd(), 'uploads')
            tiles_dir = os.path.join(uploads_dir, 'tiles', f'node_{node_id}')
            os.makedirs(tiles_dir, exist_ok=True)

            # Load source image (use random access so multi-level resizing reads correctly)
            src = pyvips.Image.new_from_file(file_path)
            orig_w = src.width
            orig_h = src.height
            logger.info(f"Tiling node {node_id}: {orig_w}x{orig_h}")

            levels_config = []
            for level_idx, (lw, lh) in enumerate(LEVEL_SIZES):
                # Skip levels larger than the original image
                if lw > orig_w or lh > orig_h:
                    if level_idx == 0:
                        # Always generate at least level 0
                        lw, lh = min(lw, orig_w), min(lh, orig_h)
                    else:
                        continue

                level_dir = os.path.join(tiles_dir, f'level_{level_idx}')
                os.makedirs(level_dir, exist_ok=True)

                # Resize to this level's dimensions
                scale_x = lw / orig_w
                scale_y = lh / orig_h
                resized = src.resize(scale_x, vscale=scale_y)

                cols = math.ceil(lw / TILE_SIZE)
                rows = math.ceil(lh / TILE_SIZE)

                for row in range(rows):
                    for col in range(cols):
                        x = col * TILE_SIZE
                        y = row * TILE_SIZE
                        tw = min(TILE_SIZE, lw - x)
                        th = min(TILE_SIZE, lh - y)

                        tile = resized.crop(x, y, tw, th)
                        tile_path = os.path.join(level_dir, f'{col}_{row}.jpg')
                        tile.jpegsave(tile_path, Q=JPEG_QUALITY, strip=True)

                levels_config.append({
                    'level': level_idx,
                    'width': lw,
                    'height': lh,
                    'cols': cols,
                    'rows': rows,
                })
                logger.info(f"  Level {level_idx} ({lw}x{lh}): {cols}x{rows} tiles")

            # Write the tile config JSON
            config = {
                'originalWidth': orig_w,
                'originalHeight': orig_h,
                'tileSize': TILE_SIZE,
                'levels': levels_config,
            }
            config_path = os.path.join(tiles_dir, 'config.json')
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)

            # Determine the base URL for these tiles
            # The route /uploads/tiles/<path> is served by __init__.py
            tile_base_url = f'/uploads/tiles/node_{node_id}'

            node.tile_status = 'ready'
            node.tile_base_url = tile_base_url
            node.tile_config = config
            node.updated_at = datetime.now(timezone.utc)
            db.session.commit()
            logger.info(f"Tiling complete for node {node_id}: {len(levels_config)} levels")

        except Exception as e:
            logger.error(f"Tiling failed for node {node_id}: {e}", exc_info=True)
            try:
                node = db.session.get(TourNode, node_id)
                if node:
                    node.tile_status = 'failed'
                    db.session.commit()
            except Exception:
                pass


def tile_panorama_async(file_path: str, node_id: int, app=None):
    """
    Spawn a background thread to tile a panorama.
    Pass the Flask app object to avoid context issues in threads.
    """
    def _run():
        try:
            if app is not None:
                with app.app_context():
                    tile_panorama(file_path, node_id)
            else:
                tile_panorama(file_path, node_id)
        except Exception as e:
            logger.error(f"Background tiling thread error for node {node_id}: {e}", exc_info=True)

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    logger.info(f"Started background tiling thread for node {node_id}")
    return t
