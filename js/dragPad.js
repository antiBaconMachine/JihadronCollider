abm.dragPad = (function(){

 var defaults = {
  draggingLevel	:	1000,
  groupExpandDelay		:	500,
  draggable : "li"
 };

 var self;
 var hooks = new abm.HookStore(["bind","group","ungroup"]);
 var dragBlocker = hooks.getBlocker("dragBlocker");
 var container;

 var onDragStart = function( ev, ui ){
  ev.stopPropagation();
  var dd = {};
  dragBlocker.block();
  dd.dragItem = jQuery(this);
  dd.group = dd.dragItem.children(".group");
  dd.isGroup = dd.group.length > 0;
  //dd.dragItem.css("z-index", self.params.draggingLevel);
  abm.log(abm.LogLevel.DEBUG, "drag init on %o %o",dd.dragItem,dd);
  var group = dd.dragItem.closest("ul.group");
  if (group.length) {
   dd.originGroup = group;
   abm.log(abm.LogLevel.DEBUG, "Dragging %o from a group", dd.dragItem);
  }
  dd.dragItem.css("visibility","hidden");
  ui.helper.data("dd",dd);
 };
 var onDrag = function( ev, ui ){
  ev.stopPropagation();
  var dd = ui.helper.data("dd");
  if (!dd.dragNotified) {
   abm.log(abm.LogLevel.DEBUG, "drag on %o %o",dd.dragItem,dd);
   dd.dragNotified=true;
  }
  if (dd.isGroup) {
   if (dd.group.hasClass("expanded")){
	abm.log(abm.LogLevel.DEBUG, "Cancelling drag as item is expanded group");
	return false;
   }
   clearTimeout(dd.group.get(0).timeout);
  }
 };
 var onDragEnd = function( ev, ui) {
  ev.stopPropagation();
  var dd = ui.helper.data("dd");
  if (dd.droppedItem) {
   var group = dd.droppedItem.children(".group");
   if (group.length && group.children().length === 0) {
	dd.droppedItem.remove();
   }
  } else {
   abm.log(abm.LogLevel.DEBUG, "%o was dropped on the container", dd.dragItem[0].id);
   if (dd.originGroup) {
	abm.log(abm.LogLevel.INFO, "removing %o from %o",dd.dragItem, dd.originGroup);
	abm.dragPad.ungroup(dd.dragItem, dd.originGroup);
   }

   dd.dragItem.css({
	top: ui.helper.css("top"),
	left: ui.helper.css("left")
   });
  }

  dd.dragItem.css({
   visibility : "inherit"
  });
  //jQuery( dd.proxy ).remove();
  dragBlocker.release();
 };

 var onDropStart = function(ev, ui) {
  ev.stopPropagation();
  var dd = ui.helper.data("dd");
  if (dd.drag == this) {
   //Don't drop onto self
   return false;
  }
  jQuery(this).addClass("active");

 };
 var onDropEnd = function(ev, ui) {
  ev.stopPropagation();
  var dd = ui.helper.data("dd");
  jQuery(this).removeClass("active");
 };
 var onDrop = function(ev, ui) {
  ev.stopPropagation();
  var dd = ui.helper.data("dd");
  jQuery(this).removeClass("active");
  abm.log(abm.LogLevel.INFO, "%o was dropped on %o %o", ui.draggable.id, this.id, dd);
  dd.droppedItem = dd.dragItem;
  var target = jQuery(this);
  if (target.find(".group").equals(dd.originGroup)) {
   return;
  }
  abm.dragPad.group(dd.dragItem, target);
 };

 var getDragHelper = function(item) {
  var id = item[0].id + "_helper";
  return function() {
   return item.clone()
   .appendTo(container)
   .attr("id",id)
   .get(0);
  }
 }

 var bindDragDropEvents = function(item, drag, drop) {
  if (!container) {
   container = jQuery(self.params.container);
  }
  if (typeof drag === "undefined") drag = true;
  if (typeof drop === "undefined") drop = true;

  item = jQuery(item);
  if (!item.data("ddBound")){
   item
   .droppable({
	addClasses : false
   })
   .bind("dropover", onDropStart)
   .bind("dropout", onDropEnd)
   .bind("drop", onDrop)
   .draggable({
	addClasses : false,
	helper : getDragHelper(item),
	containment : "parent"
   })
   .bind("dragstart", onDragStart)
   .bind("drag", onDrag)
   .bind("dragstop", onDragEnd)
   .data("ddBound",true);

   hooks.doHooks("bind", {
	item : item
   });
  }
				
  if (drag) {
   item.draggable("enable");
  }else {
   item.draggable("disable");
  }
  if (drop) {
   item.droppable("enable");
  } else {
   item.droppable("disable");
  }
 };

 var moveNode = function(nodes, target, positionRef) {
  nodes.each(function(i,node) {
   node = jQuery(node);
   target.append(node.remove());
   positionRef = positionRef || target;
   node.css({
	visibility : "inherit",
	top								:	positionRef.css("top"),
	left							:	positionRef.css("left")
   });
   bindDragDropEvents(node, true, true);
  })
				
  return nodes;
 };

 return {

  Pad : function(params) {
   self = this;
   params = params || {};
   params = jQuery.extend({}, defaults, params);
   this.params = params;

   if (params.hooks) hooks.addHooks(params.hooks);
						
   container = jQuery(params.container);
   container.find(params.draggable).each(function(i,e){
	bindDragDropEvents(e, true, true);
   });
  },

  expand : function(event) {
   //abm.log(abm.LogLevel.INFO, "expanding pile %o %o",event.data.pile, self);
   dragBlocker.doIfNotBlocked(function(){
	var data = event.data;
	var pile = data.pile;
	pile.get(0).timeout = setTimeout(function(){
	 jQuery(pile).addClass("expanded");
	 bindDragDropEvents(data.target, false, true);
	 event.data.pile.find(self.params.draggable).each(function(i,e){
	  bindDragDropEvents(e, true, false);
	 });

	}, self.params.groupExpandDelay);
   });
  },

  collapse : function(event) {
   //abm.log(abm.LogLevel.INFO, "collapsing pile %o %o", event.data.pile, event.data.pile.timeout);
   dragBlocker.doWhenNotBlocked(function(){
	var data = event.data;
	var pile = data.pile;
	clearTimeout(pile.get(0).timeout);
	pile.find(self.params.draggable).each(function(i,e){
	 bindDragDropEvents(e, false, false);
	});
	pile.removeClass("expanded");
	bindDragDropEvents(data.target, true, true);
   });
  },

  //TODO clone rather than re-wrap
  group	:	function(dropped, target) {
   var pile = target.children("ul");
   if (!pile.length) {
//	target.addClass("pile")
//	.children().wrapAll(jQuery("<ul class='group'></ul>"))
//	.wrap(jQuery("<li class='node' id='" + id + "'>"));
	var group = target
	 .wrap(jQuery("<ul class='group'>"))
	 .parent()
	 .wrap(jQuery("<li class='node'>"))
	 .parent()
	 .css({
	  top : target.css("top"),
	  left : target.css("left")
	 });

	 bindDragDropEvents(group, true, true);


	pile = target.parent();
	var data =  {
	 pile : pile,
	 target : pile.parent()
	};

	pile
	.bind("mouseenter", data, abm.dragPad.expand)
	.bind("mouseleave", data, abm.dragPad.collapse);
   }
						
   var group = dropped.children(".group");
   var items = group.length ? group.children(self.params.draggable) : dropped;
   moveNode(items, pile);

   var j = 5;
   items = pile.children();
   for (var i = items.length; i>0; i--) {
	var item = jQuery(items[i-1]);
	bindDragDropEvents(item, false, false);
	if (j > 0) {
	 item.css("top", (j*3)+"px");
	 item.css("left", (j*3)+"px");
	 j--;
	}
   }
   hooks.doHooks("group", {
	item : pile
   });
   return dropped;
  },

  ungroup : function(item, group, positionRef) {
   positionRef = positionRef || container;
   moveNode(item, container, positionRef);

   if (group.children().length <= 1) {
	moveNode(group.children().first(), container, group.parent());
	group.parent().remove();
   }
   hooks.doHooks("ungroup", {
	group : group
   });
  },
				
  getHooks : function() {
   return hooks;
  }
 }
}());