rm -rf .xpi_work_dir/
rm -f rss-ticker.xpi
mkdir .xpi_work_dir
cp -r rss-ticker/* .xpi_work_dir/
cd .xpi_work_dir/
rm -rf `find . -name ".git"`
rm -rf `find . -name ".DS_Store"`
rm -rf `find . -name "Thumbs.db"`
zip -rq ~/Desktop/rss-ticker.xpi *
cd ..
rm -rf .xpi_work_dir/
