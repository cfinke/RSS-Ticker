rm -rf .xpi_work_dir/
chmod -R 0777 rss-ticker/
rm -f rss-ticker.xpi
mkdir .xpi_work_dir
cp -r rss-ticker/* .xpi_work_dir/
cd .xpi_work_dir/
rm -rf `find . -name ".svn"`
rm -rf `find . -name ".DS_Store"`
rm -rf `find . -name "Thumbs.db"`
zip -rq ../rss-ticker.xpi *
cd ..
rm -rf .xpi_work_dir/
cp rss-ticker.xpi ~/Desktop/
