#!/bin/sh
# brand/ と public/favicon.svg から、PWA のアイコンと OGP 画像の PNG を書き出す。
# rsvg-convert（librsvg）と ImageMagick（magick）が必要。OGP 画像の文字は実行環境のフォント（macOS のヒラギノ・Menlo 等）で描く。
set -eu
cd "$(dirname "$0")/.."

rsvg-convert -w 192 -h 192 public/favicon.svg -o public/icon-192.png
rsvg-convert -w 512 -h 512 public/favicon.svg -o public/icon-512.png
rsvg-convert -w 512 -h 512 brand/icon-maskable.svg -o public/icon-maskable-512.png
rsvg-convert -w 180 -h 180 brand/icon-maskable.svg -o public/apple-touch-icon.png
rsvg-convert -w 1200 -h 630 brand/og-image.svg -o public/og-image.png

# SVG の favicon を使えないブラウザ向け（16・32px を1つの .ico にまとめる）
tmp=$(mktemp -d)
rsvg-convert -w 16 -h 16 public/favicon.svg -o "$tmp/16.png"
rsvg-convert -w 32 -h 32 public/favicon.svg -o "$tmp/32.png"
magick "$tmp/16.png" "$tmp/32.png" public/favicon.ico
rm -r "$tmp"
