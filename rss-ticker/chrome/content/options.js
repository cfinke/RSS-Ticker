var ticker;

function findTicker() {
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
	var enumerator = wm.getEnumerator(null);

	while(enumerator.hasMoreElements()) {
		var win = enumerator.getNext();
		
		if (win.RSSTICKER) {
			ticker = win.RSSTICKER;
			break;
		}
	}
}

function observeFeeds(){
	var items = document.getElementById('feeds').selectedItems;
	
	var len = items.length;
	
	for (var i = 0; i < len; i++){
		var item = items[i];
		
		if (item.nodeName == 'listitem'){
			ticker.observeFeed(item.getAttribute("value"));
			item.setAttribute("ignored","false");
		}
	}
	
	ticker.prefs.setBoolPref("updateToggle", !ticker.prefs.getBoolPref("updateToggle"));
}

function ignoreFeeds(){
	var items = document.getElementById('feeds').selectedItems;
	
	var len = items.length;
	
	for (var i = 0; i < len; i++){
		var item = items[i];
		
		if (item.nodeName == 'listitem'){
			ticker.ignoreFeed(item.getAttribute("value"));
			item.setAttribute("ignored","true");
		}
	}
	
	ticker.prefs.setBoolPref("updateToggle", !ticker.prefs.getBoolPref("updateToggle"));
}

function getFeeds(){
	var livemarkService = Components.classes["@mozilla.org/browser/livemark-service;2"].getService(Components.interfaces.nsILivemarkService);

	var feedList = document.getElementById('feeds');

	var livemarks = [];
		
	var bookmarkService = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Components.interfaces.nsINavBookmarksService);
	var anno = Components.classes["@mozilla.org/browser/annotation-service;1"].getService(Components.interfaces.nsIAnnotationService);
	var livemarkIds = anno.getItemsWithAnnotation("livemark/feedURI", {});
	
	var len = livemarkIds.length;
	
	for (var i = 0; i < len; i++){
		var livemarkId = livemarkIds[i];
		
		var feedURL = livemarkService.getFeedURI(livemarkId).spec;
		var feedTitle = bookmarkService.getItemTitle(livemarkId);
		
		livemarks.push(
			{
				"feedURL" : feedURL,
				"feedTitle" : feedTitle
			}
		);
	}
	
	var len = livemarks.length;
	
	for (var i = 0; i < len; i++){
		var livemark = livemarks[i];
		
		var opt = document.createElement('listitem');
		var o1 = document.createElement('listcell');
		var o2 = document.createElement('listcell');
		o1.setAttribute("label", livemark.feedTitle);
		o2.setAttribute("label", livemark.feedURL);
		
		opt.setAttribute("value", livemark.feedURL);
		
		opt.appendChild(o1);
		opt.appendChild(o2);
		
		feedList.appendChild(opt);
	}
	
	var ignore = ticker.readIgnoreFile();
	
	var len = feedList.childNodes.length;
	
	for (var i = 0; i < len; i++){
		var node = feedList.childNodes[i];
		
		if (ticker.inArray(ignore, node.getAttribute("value"))){
			node.setAttribute("ignored","true");
		}
	}
}

function scales() {
	var sliders = {
		"speed" : "p_tickSpeed",
		"smoothness" : "p_ticksPerItem"
	};
	
	for (var i in sliders) {
		document.getElementById(i).value = document.getElementById(sliders[i]).value;
		document.getElementById(i).setAttribute("preference", sliders[i]);
	}
}