#!/bin/sh
set -eu
# Disposable image verification using generated media only; never calls a source service.
/opt/ytdlp/bin/python - <<'CHECK'
import json,pathlib,re,subprocess
from yt_dlp.extractor import get_info_extractor
manifest=json.loads(pathlib.Path('/opt/media/share/clipnest/media-sources.json').read_text())
ffmpeg=subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0]
xml=subprocess.check_output(['xmllint','--version'],stderr=subprocess.STDOUT,text=True)
assert ffmpeg.startswith('ffmpeg version '+manifest['sources']['ffmpeg']['version']+' ')
parts=list(map(int,manifest['sources']['libxml2']['version'].split('.')))
assert int(re.search(r'using libxml version (\d+)',xml).group(1))==parts[0]*10000+parts[1]*100+parts[2]
assert get_info_extractor('Youtube')().IE_NAME=='youtube'
import yt_dlp
assert not (pathlib.Path(yt_dlp.__file__).parent/'extractor/shahid.py').exists()
print(json.dumps({'ffmpeg':ffmpeg,'libxml2':manifest['sources']['libxml2']['version'],'youtube_extractor_import':'passed'}))
CHECK
node --version
python3 --version
/opt/ytdlp/bin/yt-dlp --js-runtimes node --version
node --input-type=module -e 'import assert from "node:assert/strict"; import {scryptSync} from "node:crypto"; import pg from "pg"; import {S3Client} from "@aws-sdk/client-s3"; assert.equal(scryptSync("synthetic", "salt",32).length,32); assert.equal(typeof pg.Pool,"function"); assert.equal(typeof S3Client,"function"); console.log("NODE_RUNTIME_IMPORTS_PASSED")'
/opt/ytdlp/bin/python - <<'PY'
import importlib.util,sys
import yt_dlp,brotli,requests,websockets,mutagen
from Cryptodome.Cipher import AES
with yt_dlp.YoutubeDL({'quiet':True,'js_runtimes':{'node':{}}}): pass
assert importlib.util.find_spec('pip') is None
assert importlib.util.find_spec('setuptools') is None
print('PYTHON_YTDLP_DEFAULT_IMPORTS_PASSED')
PY
test "$(id -u)" != 0
test -w /tmp
test -w /app/.cache
test ! -e /run/secrets/build_ca
test ! -e /usr/local/bin/npm
test ! -e /usr/local/bin/npx
test ! -e /usr/local/bin/yarn
test -z "${NODE_EXTRA_CA_CERTS:-}"
test -z "${PIP_CERT:-}"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc2=size=320x180:rate=15 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 0.5 -c:v libx264 -c:a aac "$work/input.mp4"
ffmpeg -hide_banner -loglevel error -i "$work/input.mp4" -c copy "$work/remux.mkv"
ffmpeg -hide_banner -loglevel error -i "$work/input.mp4" -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -crf 35 -b:v 0 -c:a libopus "$work/output.webm"
ffmpeg -hide_banner -loglevel error -i "$work/input.mp4" -vn -c:a libmp3lame -b:a 192k "$work/output.mp3"
ffmpeg -hide_banner -loglevel error -i "$work/input.mp4" -vn -c:a copy "$work/output.m4a"
ffmpeg -hide_banner -protocols > "$work/protocols.txt"
for protocol in http https tcp tls file pipe; do grep -x "  $protocol" "$work/protocols.txt" >/dev/null; done
for file in input.mp4 remux.mkv output.webm output.mp3 output.m4a; do
  ffprobe -v error -show_format -show_streams -of json "$work/$file" > "$work/$file.json"
done
FIXTURE_DIR="$work" /opt/ytdlp/bin/python - <<'PY'
import json,os,pathlib,hashlib
p=pathlib.Path(os.environ['FIXTURE_DIR'])
expected={'input.mp4':{'h264','aac'},'remux.mkv':{'h264','aac'},'output.webm':{'vp9','opus'},'output.mp3':{'mp3'},'output.m4a':{'aac'}}
for filename,codecs in expected.items():
 d=json.loads((p/(filename+'.json')).read_text())
 actual={s['codec_name'] for s in d['streams']}
 assert actual==codecs,(filename,actual)
 assert float(d['format']['duration'])>0
 data=(p/filename).read_bytes();assert len(data)>0
 print(json.dumps({'file':filename,'codecs':sorted(actual),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}))
print('FIVE_MEDIA_FORMATS_AND_NETWORK_PROTOCOLS_PASSED')
PY
