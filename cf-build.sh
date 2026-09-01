#!/bin/sh
# 只组装玩家实际需要的静态站点；原文证据、生成工具和隔离材料不进入成品。
set -e

# 先在同一文件系统内完整组装，再一次性换入成品目录。这样即使桌面同步
# 正在扫描旧 _site，也不会在清理过程中把重复文件重新塞回新构建。
build_stage=$(mktemp -d "$PWD/.site-build.XXXXXX")
old_site=""

cleanup_stage() {
  if [ -n "$build_stage" ] && [ -d "$build_stage" ]; then
    rm -rf -- "$build_stage"
  fi
}
trap cleanup_stage EXIT INT TERM

cp    index.html    "$build_stage/"
cp -R core          "$build_stage/"
mkdir -p "$build_stage/art"
cp -R art/eras      "$build_stage/art/"
mkdir -p "$build_stage/art/portraits"
for portrait_era in art/portraits/era-*; do
  [ -d "$portrait_era" ] || continue
  cp -R "$portrait_era" "$build_stage/art/portraits/"
done
cp    sw.js         "$build_stage/"
cp    manifest.webmanifest "$build_stage/"
cp    _headers      "$build_stage/"
cp    _redirects    "$build_stage/"

if [ -e _site ]; then
  old_site=$(mktemp -d "$PWD/.site-old.XXXXXX")
  rmdir "$old_site"
  mv _site "$old_site"
fi
mv "$build_stage" _site
build_stage=""

if [ -n "$old_site" ] && [ -d "$old_site" ]; then
  trash_dir=/Users/han/.Trash/world-site-build-backups
  mkdir -p "$trash_dir"
  mv "$old_site" "$trash_dir/$(basename "$old_site")"
fi

echo "_site 组装完成："
du -sh _site
find _site -type f | wc -l
