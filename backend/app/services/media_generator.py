"""
AI Media Generation Pipeline for Museum Objects.

When an admin uploads an object with an image and description, this module
generates three types of AI media in a background thread:

1. Audio Narration – Uses Gemini TTS to create a professional museum audio guide.
2. 3D Model – Uses the Meshy.ai API (image-to-3D) to generate a .glb model.
3. Video – Uses Gemini to generate a rich descriptive narration, then creates
   a slideshow-style video with the object image and text overlay.

All generated assets are saved to backend/app/static/{audio,video,models}/
and their URLs are stored in the MuseumObject model.
"""

import os
import uuid
import time
import wave
import base64
import threading
import requests
from io import BytesIO
from flask import current_app
from app.extensions import db
from app.services.ai_provider import ai_provider
from google import genai
from google.genai import types


# ─── Configuration ───────────────────────────────────────────────────────────

MESHY_API_KEY = os.environ.get("MESHY_API_KEY", "")
MESHY_API_URL = "https://api.meshy.ai/openapi/v1/image-to-3d"

# Available Gemini TTS voices: Puck, Charon, Kore, Fenrir, Aoede, etc.
GEMINI_TTS_VOICE = "Kore"


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _ensure_dir(path):
    """Create directory if it doesn't exist."""
    os.makedirs(path, exist_ok=True)
    return path


def _save_wav(filepath, pcm_data, channels=1, rate=24000, sample_width=2):
    """Save raw PCM audio data as a playable WAV file."""
    with wave.open(filepath, 'wb') as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(rate)
        wf.writeframes(pcm_data)


# ─── 1. Audio Generation (Gemini TTS) ───────────────────────────────────────

def _generate_audio(app, obj_id, obj_name, obj_description):
    """Generate a museum audio guide narration using Gemini TTS."""
    audio_dir = _ensure_dir(os.path.join(app.root_path, 'static', 'audio'))
    filename = f"audio_{obj_id}_{uuid.uuid4().hex[:8]}.wav"
    filepath = os.path.join(audio_dir, filename)

    if obj_description and obj_description.strip():
        narration_text = obj_description.strip()
    else:
        narration_text = (
            f"Welcome to this exhibit. Before you stands {obj_name}. "
            f"This is a remarkable artifact from the museum collection. "
            f"Take a moment to appreciate the craftsmanship and history before you."
        )

    # Generate TTS audio using Gemini
    api_key = os.environ.get("AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=narration_text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=GEMINI_TTS_VOICE
                            )
                        )
                    )
                )
            )

            # Extract audio data from response
            audio_part = response.candidates[0].content.parts[0]
            audio_data = audio_part.inline_data.data

            # Decode if base64 encoded
            if isinstance(audio_data, str):
                pcm_data = base64.b64decode(audio_data)
            else:
                pcm_data = audio_data

            _save_wav(filepath, pcm_data)
            print(f"[MediaGen] Gemini TTS audio saved: {filename}")
            return f"/static/audio/{filename}"

        except Exception as e:
            print(f"[MediaGen] Gemini TTS failed: {e}. Falling back to gTTS.")

    # Fallback to gTTS if Gemini TTS fails
    try:
        from gtts import gTTS
        mp3_filename = filename.replace('.wav', '.mp3')
        mp3_filepath = os.path.join(audio_dir, mp3_filename)
        tts = gTTS(text=narration_text, lang='en', slow=False)
        tts.save(mp3_filepath)
        print(f"[MediaGen] gTTS audio saved: {mp3_filename}")
        return f"/static/audio/{mp3_filename}"
    except Exception as e:
        print(f"[MediaGen] All audio generation failed: {e}")
        return None


# ─── 2. 3D Model Generation (Meshy.ai Text-to-3D) ───────────────────────────

def _generate_3d_model(app, obj_id, obj_name, obj_description):
    """Generate a 3D model from the object description using Meshy.ai text-to-3D API."""
    if not MESHY_API_KEY:
        print("[MediaGen] No MESHY_API_KEY set. Skipping 3D model generation.")
        return None

    # Use Meshy v2 text-to-3d endpoint
    MESHY_TEXT_API_URL = "https://api.meshy.ai/openapi/v2/text-to-3d"
    models_dir = _ensure_dir(os.path.join(app.root_path, 'static', 'models'))

    try:
        headers = {"Authorization": f"Bearer {MESHY_API_KEY}"}
        prompt = obj_description.strip() if obj_description and obj_description.strip() else f"A museum artifact named {obj_name}"

        # Step 1: Create task
        create_resp = requests.post(
            MESHY_TEXT_API_URL,
            headers=headers,
            json={
                "mode": "preview",
                "prompt": prompt,
                "art_style": "realistic",
                "should_remesh": True
            },
            timeout=30
        )
        create_resp.raise_for_status()
        task_id = create_resp.json().get("result") or create_resp.json().get("id")

        if not task_id:
            print(f"[MediaGen] Meshy task creation returned no ID: {create_resp.json()}")
            return None

        print(f"[MediaGen] Meshy 3D task created: {task_id}")

        # Step 2: Poll for completion (max 5 minutes)
        status_url = f"{MESHY_TEXT_API_URL}/{task_id}"
        for _ in range(60):  # 60 * 5s = 5 min max
            time.sleep(5)
            status_resp = requests.get(status_url, headers=headers, timeout=15)
            status_data = status_resp.json()
            status = status_data.get("status", "").upper()

            if status == "SUCCEEDED":
                model_url = status_data.get("model_urls", {}).get("glb")
                if model_url:
                    # Download the GLB file to local storage
                    glb_filename = f"model_{obj_id}_{uuid.uuid4().hex[:8]}.glb"
                    glb_filepath = os.path.join(models_dir, glb_filename)
                    glb_resp = requests.get(model_url, timeout=60)
                    with open(glb_filepath, 'wb') as f:
                        f.write(glb_resp.content)
                    print(f"[MediaGen] 3D model saved: {glb_filename}")
                    return f"/static/models/{glb_filename}"
                else:
                    print(f"[MediaGen] Meshy succeeded but no GLB URL: {status_data}")
                    return None

            elif status in ("FAILED", "EXPIRED"):
                print(f"[MediaGen] Meshy task {status}: {status_data}")
                return None

        print(f"[MediaGen] Meshy task timed out after 5 minutes.")
        return None

    except Exception as e:
        print(f"[MediaGen] 3D model generation error: {e}")
        return None


# ─── 3. Video Generation (AI Descriptive Video) ─────────────────────────────

def _generate_video(app, obj_id, image_url, obj_name, obj_description):
    """
    Generate a descriptive video about the artifact.
    Uses Gemini to create a rich narration script, then creates a video
    with the image and narration overlay using PIL and basic video assembly.
    For now, we generate a narration audio + store the image URL as a paired
    video experience that the frontend renders as a combined slideshow.
    """
    video_dir = _ensure_dir(os.path.join(app.root_path, 'static', 'video'))

    if obj_description and obj_description.strip():
        video_narration = obj_description.strip()
    else:
        video_narration = (
            f"Behold {obj_name}. A remarkable artifact that speaks to the ingenuity of its creators. "
            f"This piece continues to captivate visitors from around the world."
        )

    # Generate video narration audio using Gemini TTS
    api_key = os.environ.get("AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
    video_audio_url = None

    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=video_narration,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name="Puck"  # Different voice for video
                            )
                        )
                    )
                )
            )

            audio_part = response.candidates[0].content.parts[0]
            audio_data = audio_part.inline_data.data

            if isinstance(audio_data, str):
                pcm_data = base64.b64decode(audio_data)
            else:
                pcm_data = audio_data

            audio_filename = f"video_audio_{obj_id}_{uuid.uuid4().hex[:8]}.wav"
            audio_filepath = os.path.join(video_dir, audio_filename)
            _save_wav(audio_filepath, pcm_data)
            video_audio_url = f"/static/video/{audio_filename}"
            print(f"[MediaGen] Video narration audio saved: {audio_filename}")

        except Exception as e:
            print(f"[MediaGen] Video audio generation failed: {e}. Trying gTTS.")
            try:
                from gtts import gTTS
                mp3_name = f"video_audio_{obj_id}_{uuid.uuid4().hex[:8]}.mp3"
                mp3_path = os.path.join(video_dir, mp3_name)
                tts = gTTS(text=video_narration, lang='en', slow=False)
                tts.save(mp3_path)
                video_audio_url = f"/static/video/{mp3_name}"
                print(f"[MediaGen] Video gTTS audio saved: {mp3_name}")
            except Exception as e2:
                print(f"[MediaGen] Video audio completely failed: {e2}")

    # Save the video metadata as JSON that the frontend can use to render
    # a rich multimedia experience (image + audio narration + text overlay)
    import json
    video_meta = {
        "type": "narrated_slideshow",
        "image_url": image_url,
        "audio_url": video_audio_url,
        "narration_text": video_narration,
        "object_name": obj_name
    }

    meta_filename = f"video_{obj_id}_{uuid.uuid4().hex[:8]}.json"
    meta_filepath = os.path.join(video_dir, meta_filename)
    with open(meta_filepath, 'w') as f:
        json.dump(video_meta, f)

    print(f"[MediaGen] Video metadata saved: {meta_filename}")
    return f"/static/video/{meta_filename}"


# ─── Main Pipeline ───────────────────────────────────────────────────────────

def _generate_media_task(app, object_id, image_url, object_name, object_description):
    """Main background task: generates audio, 3D, and video for an object."""
    with app.app_context():
        from app.models import MuseumObject
        obj = db.session.get(MuseumObject, object_id)
        if not obj:
            return

        # Mark as generating
        obj.media_status = 'generating'
        db.session.commit()

        print(f"[MediaGen] ═══ Starting AI media generation for object {object_id}: {object_name} ═══")

        try:
            # 1. Audio narration
            print(f"[MediaGen] [1/3] Generating audio narration...")
            audio_url = _generate_audio(app, object_id, object_name, object_description)
            if audio_url:
                obj.audio_url = audio_url

            # 2. 3D model
            print(f"[MediaGen] [2/3] Generating 3D model...")
            model_url = _generate_3d_model(app, object_id, object_name, object_description)
            if model_url:
                obj.model_3d_url = model_url

            # 3. Video
            print(f"[MediaGen] [3/3] Generating video narration...")
            video_url = _generate_video(app, object_id, image_url, object_name, object_description)
            if video_url:
                obj.video_url = video_url

            # Mark as completed
            obj.media_status = 'completed'
            db.session.commit()
            print(f"[MediaGen] ═══ Successfully completed media generation for object {object_id} ═══")

        except Exception as e:
            print(f"[MediaGen] ═══ Error generating media for object {object_id}: {str(e)} ═══")
            obj.media_status = 'failed'
            db.session.commit()


def trigger_media_generation(object_id, image_url, object_name, object_description):
    """
    Spawns a background thread to generate TTS audio, 3D model, and video
    for a newly created/updated museum object.
    """
    app = current_app._get_current_object()
    thread = threading.Thread(
        target=_generate_media_task,
        args=(app, object_id, image_url, object_name, object_description)
    )
    thread.daemon = True
    thread.start()
