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
	
	for (var i = 0; i < items.length; i++){
		if (items[i].nodeName == 'listitem'){
			ticker.observeFeed(items[i].getAttribute("value"));
			items[i].setAttribute("ignored","false");
		}
	}
	
	ticker.prefs.setBoolPref("updateToggle", !ticker.prefs.getBoolPref("updateToggle"));
}

function ignoreFeeds(){
	var items = document.getElementById('feeds').selectedItems;
	
	for (var i = 0; i < items.length; i++){
		if (items[i].nodeName == 'listitem'){
			ticker.ignoreFeed(items[i].getAttribute("value"));
			items[i].setAttribute("ignored","true");
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

	for (var i = 0; i < livemarkIds.length; i++){
		var feedURL = livemarkService.getFeedURI(livemarkIds[i]).spec;
		var feedTitle = bookmarkService.getItemTitle(livemarkIds[i]);
		
		livemarks.push(
			{
				"feedURL" : feedURL,
				"feedTitle" : feedTitle
			}
		);
	}
	
	for (var i = 0; i < livemarks.length; i++){
		var opt = document.createElement('listitem');
		var o1 = document.createElement('listcell');
		var o2 = document.createElement('listcell');
		o1.setAttribute("label",livemarks[i].feedTitle);
		o2.setAttribute("label",livemarks[i].feedURL);
		
		opt.setAttribute("value",livemarks[i].feedURL);
		
		opt.appendChild(o1);
		opt.appendChild(o2);
		
		feedList.appendChild(opt);
	}
	
	var ignore = ticker.readIgnoreFile();
	
	for (var i = 0; i < feedList.childNodes.length; i++){
		if (ticker.inArray(ignore, feedList.childNodes[i].getAttribute("value"))){
			feedList.childNodes[i].setAttribute("ignored","true");
		}
	}
}

function scales() {
	var sliders = {
		"speed" : "p_tickSpeed",
		"smoothness" : "p_ticksPerItem",
		"frequency" : "p_updateFrequency"
	};
	
	for (var i in sliders) {
		document.getElementById(i).value = document.getElementById(sliders[i]).value;
		document.getElementById(i).setAttribute("preference", sliders[i]);
	}
}