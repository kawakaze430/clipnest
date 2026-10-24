#!/bin/sh
# Build matching patched XML/media libraries; do not replace a distro ABI in place.
set -eu
python3 /build/fetch-media.py /build/media-sources.json /tmp/media-src
cd /tmp/media-src/libxml2-source
./autogen.sh --prefix=/opt/media --without-python --without-docs
make -j2
make install
cd /tmp/media-src/ffmpeg-source
PKG_CONFIG_PATH=/opt/media/lib/pkgconfig ./configure \
  --prefix=/opt/media --disable-autodetect --disable-doc --disable-debug \
  --enable-shared --disable-static --enable-gpl --enable-version3 \
  --enable-pthreads --enable-libxml2 --enable-openssl --enable-zlib --enable-lzma \
  --enable-libx264 --enable-libmp3lame --enable-libvpx --enable-libopus \
  --extra-cflags=-I/opt/media/include \
  --extra-ldflags=-Wl,-rpath,/opt/media/lib || { tail -n 100 ffbuild/config.log; exit 1; }
make -j2
make install
mkdir -p /opt/media/share/clipnest/licenses
cp /build/media-sources.json /opt/media/share/clipnest/media-sources.json
cp /tmp/media-src/libxml2-source/Copyright /opt/media/share/clipnest/licenses/libxml2-Copyright
cp /tmp/media-src/ffmpeg-source/COPYING.GPLv3 /opt/media/share/clipnest/licenses/FFmpeg-COPYING.GPLv3
rm -rf /opt/media/include /opt/media/lib/pkgconfig
rm -f /opt/media/lib/*.a /opt/media/lib/*.la
