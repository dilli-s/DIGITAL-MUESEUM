import os
import sys
import json
import shutil
import urllib.request
import urllib.parse
import ssl

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app
from app.extensions import db
from app.models import Museum, MuseumObject

HEADERS = {'User-Agent': 'DigitalMuseumBot/1.0 (contact@digitalmuseum.test)'}
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

MUSEUM_CONFIG = {
    1: {
        'filename': 'museum_1_oriental_institute.jpg',
        'query': 'Institute for the Study of Ancient Cultures',
        'fallback_title': 'Oriental Institute (Chicago)'
    },
    2: {
        'filename': 'museum_2_moma.jpg',
        'query': 'Museum of Modern Art',
        'fallback_title': 'MoMA'
    },
    3: {
        'filename': 'museum_3_louvre.jpg',
        'query': 'Louvre',
        'fallback_title': 'Louvre Museum'
    },
    4: {
        'filename': 'museum_4_acropolis.jpg',
        'query': 'Acropolis Museum',
        'fallback_title': 'Athens Acropolis Museum'
    },
    5: {
        'filename': 'museum_5_natural_history.jpg',
        'query': 'National Museum of Natural History',
        'fallback_title': 'Smithsonian National Museum of Natural History'
    },
    6: {
        'filename': 'museum_6_kyoto.jpg',
        'query': 'Kyoto National Museum',
        'fallback_title': 'Kyoto National Museum building'
    }
}

# Mapping of normalized artifact name keywords to search queries
ARTIFACT_QUERIES = {
    't-rex skeleton': ('Tyrannosaurus', 'Tyrannosaurus rex fossil skeleton'),
    'triceratops skull': ('Triceratops', 'Triceratops skull fossil'),
    'lucy australopithecus': ('Lucy (Australopithecus)', 'Lucy fossil skeleton'),
    'oriental institute information': ('Museum audio guide', 'Visitor center kiosk'),
    'suq museum bookstore': ('Oriental Institute', 'Museum gift shop bookstore'),
    'james henry breasted chronology mural': ('James Henry Breasted', 'Oriental Institute mural'),
    'jarmo clay mother goddess figurine': ('Jarmo', 'Venus figurine Neolithic'),
    'hassuna painted ceramic': ('Hassuna culture', 'Hassuna pottery jar'),
    'statue of a sumerian worshiper from tell asmar': ('Tell Asmar Hoard', 'Sumerian worshipper statue'),
    'babylonian striding lion glazed brick relief': ('Lion of Babylon (statue)', 'Ishtar Gate lion relief'),
    'epic of gilgamesh cuneiform tablet fragment': ('Epic of Gilgamesh', 'Gilgamesh cuneiform tablet'),
    'colossal winged bull (lamassu)': ('Lamassu', 'Winged bull Sargon II'),
    'palace bas-relief of sargon ii and dignitaries': ('Sargon II', 'Assyrian palace relief'),
    'banquet stele': ('Ashurnasirpal II', 'Assyrian banquet stele'),
    'tell tayinat column base with twin lions': ('Tell Tayinat', 'Tayinat lions column base'),
    'the megiddo ivories': ('Megiddo ivories', 'Megiddo ivory carving'),
    'colossal 17-foot statue of king tutankhamun': ('Statue of Tutankhamun', 'Tutankhamun statue'),
    'polychrome painted coffin of petosiris': ('Tomb of Petosiris', 'Petosiris painted coffin'),
    'painted coffin and cartonnage of petosiris': ('Tomb of Petosiris', 'Petosiris painted coffin'),
    'persepolis column capital with double bull protome': ('Persepolis', 'Persepolis bull capital'),
    'kerma classic tulip-shaped decorated beaker': ('Kerma culture', 'Kerma tulip beaker pottery'),
    'silk road bactrian bronze mirror & sealstones': ('Bactria', 'Bactrian bronze mirror'),
    'historic 1931 hand-carved oak lecture rostrum': ('Podium', 'Lecture rostrum wood carved'),
    'central octagonal limestone fountain basin': ('Fountain', 'Octagonal stone fountain'),
    'judeideh bronze statuettes of gods and warriors': ('Tell Judeideh', 'Canaanite bronze figurine'),
    'granite sarcophagus of vizier bakenranef': ('Bakenrenef', 'Bakenranef sarcophagus granite'),
    'papyrus of nes-min: book of the dead scroll': ('Book of the Dead', 'Ancient Egyptian Book of the Dead papyrus'),
    'number 1a, 1948': ('Jackson Pollock', 'Pollock abstract expressionism'),
    'color field abstraction no. 5': ('Color Field', 'Mark Rothko color field painting'),
    'kinetic steel mobile': ('Alexander Calder', 'Calder mobile sculpture'),
    'surrealist bronze figure': ('Alberto Giacometti', 'Giacometti walking man bronze sculpture'),
    'neon luminescence installation': ('Dan Flavin', 'Minimalist neon fluorescent light art installation'),
    'great sphinx of tanis': ('Great Sphinx of Tanis', 'Sphinx of Tanis granite Louvre'),
    'mona lisa': ('Mona Lisa', 'Mona Lisa Leonardo da Vinci portrait'),
    'winged victory of samothrace': ('Winged Victory of Samothrace', 'Nike of Samothrace marble sculpture'),
    'venus de milo': ('Venus de Milo', 'Aphrodite of Milos classical statue'),
    'french crown jewels diadem': ('French Crown Jewels', 'Empress Eugenie pearl diamond diadem crown'),
    'caryatid maiden kore': ('Caryatid', 'Erechtheion Caryatid porch marble kore'),
    'archaic calf-bearer moschophoros': ('Moschophoros', 'Moschophoros calf bearer statue Athens'),
    'parthenon frieze marble slab': ('Parthenon Frieze', 'Parthenon marble relief procession'),
    'sandalbinder nike relief': ('Temple of Athena Nike', 'Nike adjusting her sandal marble relief'),
    'tyrannosaurus rex nation\'s t. rex': ('Tyrannosaurus', 'Tyrannosaurus rex fossil mounted'),
    'north atlantic right whale phoenix': ('North Atlantic right whale', 'Right whale specimen model museum'),
    'hope diamond 45-carat deep blue': ('Hope Diamond', 'Hope Diamond blue gemstone Smithsonian'),
    'african elephant henry': ('African bush elephant', 'Mounted African bush elephant museum rotunda'),
    'standing jūichimen kannon': ('Guanyin', 'Eleven-headed Kannon Japanese Buddhist sculpture'),
    'meibutsu bizen nagamitsu katana': ('Katana', 'Japanese samurai katana sword blade'),
    'wind god and thunder god byōbu': ('Fūjin and Raijin', 'Fujin Raijin golden screen painting Tawaraya Sotatsu'),
    'edo gold makie writing box': ('Maki-e', 'Japanese lacquer suzuribako gold writing box')
}

def fetch_wiki_thumbnail(title):
    try:
        url = f'https://en.wikipedia.org/w/api.php?action=query&titles={urllib.parse.quote(title)}&prop=pageimages&format=json&pithumbsize=1000'
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10, context=ssl_ctx) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            pages = data.get('query', {}).get('pages', {})
            for p in pages.values():
                thumb = p.get('thumbnail', {}).get('source')
                if thumb:
                    return thumb
    except Exception as e:
        print(f'Error fetching title {title}: {e}')
    return None

def fetch_commons_image(search_term):
    try:
        url = f'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={urllib.parse.quote(search_term)}&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=1000&format=json'
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10, context=ssl_ctx) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            pages = data.get('query', {}).get('pages', {})
            for p in pages.values():
                ii = p.get('imageinfo', [{}])[0]
                thumb = ii.get('thumburl') or ii.get('url')
                if thumb and not thumb.lower().endswith('.svg') and not thumb.lower().endswith('.svg.png'):
                    return thumb
    except Exception as e:
        print(f'Error searching commons {search_term}: {e}')
    return None

def download_image(url, target_path):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15, context=ssl_ctx) as resp:
            content = resp.read()
            if len(content) > 1000:
                with open(target_path, 'wb') as f:
                    f.write(content)
                return True
    except Exception as e:
        print(f'Failed to download {url}: {e}')
    return False

def main():
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    uploads_dir = os.path.join(backend_dir, 'uploads')
    root_uploads = os.path.join(os.path.dirname(backend_dir), 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)
    os.makedirs(root_uploads, exist_ok=True)

    print('Cleaning up old junk images in uploads directory...')
    preserve_files = {'apartment_4room_plan.png', 'oriental_institute_floorplan.png'}
    for f in os.listdir(uploads_dir):
        if f not in preserve_files and not f.startswith('.'):
            p = os.path.join(uploads_dir, f)
            if os.path.isfile(p):
                os.remove(p)

    for f in os.listdir(root_uploads):
        if f not in preserve_files and not f.startswith('.'):
            p = os.path.join(root_uploads, f)
            if os.path.isfile(p):
                os.remove(p)

    print('1. Downloading Museum Images...')
    museum_img_map = {}
    for mid, cfg in MUSEUM_CONFIG.items():
        fname = cfg['filename']
        target_path = os.path.join(uploads_dir, fname)
        thumb_url = fetch_wiki_thumbnail(cfg['query'])
        if not thumb_url:
            thumb_url = fetch_commons_image(cfg['fallback_title'])
        if not thumb_url:
            thumb_url = fetch_commons_image(cfg['query'])

        if thumb_url and download_image(thumb_url, target_path):
            print(f'  [OK] Museum {mid} -> {fname} ({os.path.getsize(target_path)} bytes)')
            shutil.copy2(target_path, os.path.join(root_uploads, fname))
            museum_img_map[mid] = f'/uploads/{fname}'
        else:
            print(f'  [FAILED] Museum {mid}')

    print('2. Downloading Artifact Images...')
    artifact_img_cache = {}
    for norm_key, (wiki_title, commons_search) in ARTIFACT_QUERIES.items():
        slug = norm_key.replace(' ', '_').replace('(', '').replace(')', '').replace("'", '').replace('&', 'and')[:35]
        fname = f'art_{slug}.jpg'
        target_path = os.path.join(uploads_dir, fname)

        if not os.path.exists(target_path) or os.path.getsize(target_path) < 1000:
            thumb_url = fetch_wiki_thumbnail(wiki_title)
            if not thumb_url:
                thumb_url = fetch_commons_image(commons_search)
            if not thumb_url:
                thumb_url = fetch_commons_image(wiki_title)

            if thumb_url and download_image(thumb_url, target_path):
                print(f'  [OK] {norm_key} -> {fname} ({os.path.getsize(target_path)} bytes)')
                shutil.copy2(target_path, os.path.join(root_uploads, fname))
                artifact_img_cache[norm_key] = f'/uploads/{fname}'
            else:
                print(f'  [FAILED] {norm_key}')
        else:
            artifact_img_cache[norm_key] = f'/uploads/{fname}'

    app = create_app()
    with app.app_context():
        print('3. Updating Database Records...')
        for mid, img_path in museum_img_map.items():
            m = db.session.get(Museum, mid)
            if m:
                m.image = img_path
                print(f'  Updated Museum {mid}: {m.name} -> {img_path}')

        all_objects = MuseumObject.query.all()
        for o in all_objects:
            oname_lower = o.name.lower().strip()
            matched_img = None
            for k, img_path in artifact_img_cache.items():
                if k in oname_lower or oname_lower in k:
                    matched_img = img_path
                    break
            
            # If no direct match, check partial keywords
            if not matched_img:
                for k, img_path in artifact_img_cache.items():
                    first_word = k.split()[0]
                    if len(first_word) > 4 and first_word in oname_lower:
                        matched_img = img_path
                        break

            if not matched_img:
                # Fallback to museum image or general artifact image
                matched_img = museum_img_map.get(o.museum_id, '/uploads/museum_1_oriental_institute.jpg')

            o.image = matched_img
            o.images = [matched_img]

        db.session.commit()
        print(f'  Updated {len(all_objects)} objects in database with authentic images.')

    # 4. Update seed_data.json
    seed_data_path = os.path.join(backend_dir, 'seed_data.json')
    if os.path.exists(seed_data_path):
        print('4. Updating backend/seed_data.json...')
        with open(seed_data_path, 'r', encoding='utf-8') as f:
            seed_data = json.load(f)

        for m_item in seed_data.get('museums', []):
            mid = m_item.get('id')
            if mid in museum_img_map:
                m_item['image'] = museum_img_map[mid]

        for o_item in seed_data.get('objects', []):
            oname_lower = o_item.get('name', '').lower().strip()
            matched_img = None
            for k, img_path in artifact_img_cache.items():
                if k in oname_lower or oname_lower in k:
                    matched_img = img_path
                    break
            if not matched_img:
                matched_img = museum_img_map.get(o_item.get('museumId', 1), '/uploads/museum_1_oriental_institute.jpg')
            o_item['image'] = matched_img
            o_item['images'] = [matched_img]

        with open(seed_data_path, 'w', encoding='utf-8') as f:
            json.dump(seed_data, f, indent=2)
        print('  seed_data.json updated successfully.')

    print('\nAll museum and object images successfully updated!')

if __name__ == '__main__':
    main()
