import json
import re
from pathlib import Path
from ytmusicapi import YTMusic

yt = YTMusic()

queries = [
    ('The Weeknd', 'the-weeknd', 'pop'),
    ('Taylor Swift', 'taylor-swift', 'pop'),
    ('Billie Eilish', 'billie-eilish', 'alternative'),
    ('Coldplay', 'coldplay', 'alternative'),
    ('Daft Punk', 'daft-punk', 'electronic'),
    ('Dua Lipa', 'dua-lipa', 'pop'),
    ('Drake', 'drake', 'hiphop'),
    ('Ed Sheeran', 'ed-sheeran', 'pop'),
    ('Bruno Mars', 'bruno-mars', 'soul'),
    ('Kendrick Lamar', 'kendrick-lamar', 'hiphop'),
    ('Hans Zimmer', 'hans-zimmer', 'cinematic'),
    ('Nils Frahm', 'nils-frahm', 'ambient')
]

artists_data = []
albums_data = []
tracks_data = []
seen_videos = set()

def clean_thumb(item, vid):
    thumbs = item.get('thumbnails') or []
    if thumbs:
        best = thumbs[-1].get('url', '')
        if best:
            return best.split('=')[0] + '=w544-h544-l90-rj' if 'googleusercontent' in best else best
    return f'https://i.ytimg.com/vi/{vid}/hqdefault.jpg'

for name, artist_id, genre in queries:
    print(f'Fetching {name}...')
    try:
        songs = yt.search(f'{name} official song', filter='songs', limit=6)
    except Exception as e:
        print(f'Error searching {name}: {e}')
        continue

    artist_track_ids = []
    artist_image = ''
    album_id = f'al-{artist_id}'

    for i, s in enumerate(songs[:6]):
        vid = s.get('videoId')
        if not vid or vid in seen_videos:
            continue
        seen_videos.add(vid)
        thumb = clean_thumb(s, vid)
        if not artist_image:
            artist_image = thumb

        title = s.get('title') or 'Song'
        dur = s.get('duration_seconds') or 210
        if not isinstance(dur, int):
            dur = 210

        t_id = f'yt-{vid}'
        artist_track_ids.append(t_id)

        tracks_data.append({
            'id': t_id,
            'title': title,
            'artistId': artist_id,
            'albumId': album_id,
            'duration': dur,
            'audioUrl': '',
            'artwork': thumb,
            'source': 'youtube',
            'youtubeId': vid,
            'genreIds': [genre],
            'mood': 'Top Hits',
            'plays': 45000000 + i * 5000000,
            'trackNumber': i + 1,
            'explicit': bool(s.get('isExplicit', False))
        })

    if artist_track_ids:
        albums_data.append({
            'id': album_id,
            'title': f'{name} Essentials',
            'artistId': artist_id,
            'year': 2024,
            'releaseDate': '2024-01-01',
            'type': 'Album',
            'artwork': artist_image or (f'https://i.ytimg.com/vi/{songs[0].get("videoId")}/hqdefault.jpg' if songs else ''),
            'genreIds': [genre],
            'description': f'The essential collection of hits and fan favourites by {name}.',
            'trackIds': artist_track_ids
        })

        artists_data.append({
            'id': artist_id,
            'name': name,
            'bio': f'{name} is one of the world\'s most streamed artists on YouTube Music and Spotify.',
            'shortBio': f'Top artist · {genre.capitalize()}',
            'image': artist_image,
            'location': 'Global',
            'monthlyListeners': 75000000,
            'followers': 42000000,
            'genreIds': [genre],
            'relatedArtistIds': [],
            'verified': True
        })

playlists_data = [
    {
        'id': 'todays-top-hits',
        'title': "Today's Top Hits",
        'description': 'The biggest hits right now from YouTube Music and Spotify.',
        'curator': 'Spotify & YouTube Music',
        'artwork': tracks_data[0]['artwork'] if tracks_data else '',
        'trackIds': [t['id'] for t in tracks_data[:15]],
        'genreIds': ['pop'],
        'accent': '#1DB954',
        'featured': True
    },
    {
        'id': 'global-top-50',
        'title': 'Global Top 50',
        'description': 'Your daily update of the most played tracks worldwide.',
        'curator': 'AURA Charts',
        'artwork': tracks_data[6]['artwork'] if len(tracks_data) > 6 else '',
        'trackIds': [t['id'] for t in tracks_data[5:20]],
        'genreIds': ['pop', 'hiphop'],
        'accent': '#8B5CF6',
        'featured': True
    },
    {
        'id': 'chill-hits',
        'title': 'Chill Hits',
        'description': 'Kick back to the best relaxed tracks and smooth vibes.',
        'curator': 'AURA Curation',
        'artwork': tracks_data[12]['artwork'] if len(tracks_data) > 12 else '',
        'trackIds': [t['id'] for t in tracks_data[10:25]],
        'genreIds': ['alternative', 'ambient'],
        'accent': '#3B82F6',
        'featured': True
    }
]

genres_data = [
    {'id': 'pop', 'name': 'Pop', 'description': 'The biggest hooks and brightest productions.', 'image': tracks_data[0]['artwork'] if tracks_data else '', 'accent': '#1DB954', 'trackIds': [t['id'] for t in tracks_data if 'pop' in t['genreIds']]},
    {'id': 'hiphop', 'name': 'Hip-Hop', 'description': 'Beats, bars, and the modern soundscape.', 'image': tracks_data[4]['artwork'] if len(tracks_data) > 4 else '', 'accent': '#F59E0B', 'trackIds': [t['id'] for t in tracks_data if 'hiphop' in t['genreIds']]},
    {'id': 'alternative', 'name': 'Alternative', 'description': 'Bold voices charting their own path.', 'image': tracks_data[2]['artwork'] if len(tracks_data) > 2 else '', 'accent': '#EC4899', 'trackIds': [t['id'] for t in tracks_data if 'alternative' in t['genreIds']]},
    {'id': 'electronic', 'name': 'Electronic', 'description': 'Synthesizers, clubs and nocturnal energy.', 'image': tracks_data[8]['artwork'] if len(tracks_data) > 8 else '', 'accent': '#8B5CF6', 'trackIds': [t['id'] for t in tracks_data if 'electronic' in t['genreIds']]},
    {'id': 'soul', 'name': 'Soul & R&B', 'description': 'Warm voices and deep grooves.', 'image': tracks_data[10]['artwork'] if len(tracks_data) > 10 else '', 'accent': '#EF4444', 'trackIds': [t['id'] for t in tracks_data if 'soul' in t['genreIds']]},
    {'id': 'ambient', 'name': 'Ambient & Focus', 'description': 'Atmospheric soundscapes for concentration.', 'image': tracks_data[-1]['artwork'] if tracks_data else '', 'accent': '#10B981', 'trackIds': [t['id'] for t in tracks_data if 'ambient' in t['genreIds']]}
]

featured_hero = {
    'eyebrow': 'SPOTIFY & YOUTUBE MUSIC SELECTION',
    'title': albums_data[0]['title'] if albums_data else 'Global Hits',
    'artist': artists_data[0]['name'] if artists_data else 'The Weeknd',
    'description': "Experience the world's top records streamed directly from YouTube Music with pure audio and video mode.",
    'albumId': albums_data[0]['id'] if albums_data else '',
    'artwork': albums_data[0]['artwork'] if albums_data else '',
    'trackIds': albums_data[0]['trackIds'][:4] if albums_data else [],
    'accent': '#1DB954'
}

payload = {
    'generatedAt': '2026-10-31',
    'source': 'ytmusicapi',
    'artists': artists_data,
    'albums': albums_data,
    'tracks': tracks_data,
    'playlists': playlists_data,
    'genres': genres_data,
    'featuredHero': featured_hero
}

out_path = Path('data/ytmusic-catalog.json')
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Successfully generated {len(artists_data)} artists, {len(albums_data)} albums, {len(tracks_data)} real tracks!')
