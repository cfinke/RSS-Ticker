rm rss-ticker.xpi
rm -rf .tmp_xpi_dir/

chmod -R 0777 rss-ticker/

mkdir .tmp_xpi_dir/
cp -r rss-ticker/* .tmp_xpi_dir/

rm -rf `find ./.tmp_xpi_dir/ -name ".DS_Store"`
rm -rf `find ./.tmp_xpi_dir/ -name "Thumbs.db"`
rm -rf `find ./.tmp_xpi_dir/ -name ".svn"`

cd .tmp_xpi_dir/chrome/
zip -rq ../rss-ticker.jar *
rm -rf *
mv ../rss-ticker.jar ./
cd ../
zip -rq ../rss-ticker.xpi *
cd ../
rm -rf .tmp_xpi_dir/
cp rss-ticker.xpi ~/Desktop/
