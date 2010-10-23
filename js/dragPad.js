db.dragPad = (function(){

		var defaults = {
				draggingLevel	:	1000,
				groupExpandDelay		:	500
		};

		var self;
		var dragBlocker = new db.Blocker();
		var hooks = new db.util.HookStore(["bind","unbind","group","ungroup"]);
		var container;

		var onDragInit = function( ev, dd) {
				dragBlocker.block();
				dd.dragItem = jQuery(this);
				dd.group = dd.dragItem.children(".group");
				dd.isGroup = dd.group.length > 0;
				dd.dragItem.css("z-index", self.params.draggingLevel);
				db.log(db.LogLevel.DEBUG, "drag init on %o %o",dd.dragItem,dd);
		};
		var onDragStart = function( ev, dd ){
				var group = dd.dragItem.closest("ul.group");
				if (group.length) {
						dd.originGroup = group;
						db.log(db.LogLevel.DEBUG, "Dragging %o from a group", dd.dragItem);
				}

				dd.limit = container.offset();
				dd.limit.bottom = dd.limit.top + container.outerHeight() - dd.dragItem.outerHeight();
				dd.limit.right = dd.limit.left + container.outerWidth() - dd.dragItem.outerWidth();

				dd.drop.length ? dd.dragItem.addClass("over") : dd.dragItem.removeClass("over");
				//db.log(db.LogLevel.DEBUG, "drag start on %o %o",dd.dragItem,dd);
				dd.dragItem.css("visibility","hidden");
				return dd.dragItem.clone()
				.css("visibility","visible")
				.addClass("proxy")
				.appendTo( container )
		};
		var onDrag = function( ev, dd ){
				if (!dd.dragNotified) {
						db.log(db.LogLevel.DEBUG, "drag on %o %o",dd.dragItem,dd);
						dd.dragNotified=true;
				}
				if (dd.isGroup) {
						if (dd.group.hasClass("expanded")){
								db.log(db.LogLevel.DEBUG, "Cancelling drag as item is expanded group");
								return false;
						}
						clearTimeout(dd.group.get(0).timeout);
				}
				if (!dd.$proxy) {
				 dd.$proxy = jQuery(dd.proxy);
				}
				dd.$proxy.css({
						top: Math.min( dd.limit.bottom, Math.max( dd.limit.top, dd.offsetY ) ),
						left: Math.min( dd.limit.right, Math.max( dd.limit.left, dd.offsetX ) )
				});
		};
		var onDragEnd = function( ev, dd) {
				if (dd.droppedItem) {
						var group = dd.droppedItem.children(".group");
						if (group.length && group.children().length === 0) {
								dd.droppedItem.remove();
						}
				} else {
						db.log(db.LogLevel.INFO, "%o was dropped on the container", dd.drag.id);
						if (dd.originGroup) {
								db.log(db.LogLevel.INFO, "removing %o from %o",dd.dragItem, dd.originGroup);
								db.dragPad.ungroup(dd.dragItem, dd.originGroup);
						}

						dd.dragItem.css({
						 top: dd.$proxy.css("top"),
						 left: dd.$proxy.css("left")
						});
				}

				dd.dragItem.css({
						visibility : "inherit"
				});
				jQuery( dd.proxy ).remove();
				dragBlocker.release();
		};


		var bindDragDropEvents = function(item) {
				if (!container) {
						container = jQuery(self.params.container);
				}
				item = jQuery(item);
				if (!item.data("ddBound")){
						item
						.drag("init", onDragInit)
						.drag("start", onDragStart)
						.drag(onDrag)
						.drag("end", onDragEnd)
						.drop("start", function( ev, dd) {
								if (dd.drag == this) {
										//Don't drop onto self
										return false;
								}
								jQuery(this).addClass("active");
						})
						.drop("end", function( ev, dd) {
								jQuery(this).removeClass("active");
						})
						.drop(function( ev, dd) {
								db.log(db.LogLevel.INFO, "%o was dropped on %o %o", dd.drag.id, this.id, dd);
								dd.droppedItem = dd.dragItem;
								var target = jQuery(this);
								if (target.find(".group").equals(dd.originGroup)) {
										return;
								}
								db.dragPad.group(dd.dragItem, target);
						})
						.data("ddBound",true);

						hooks.doHooks("bind", {item : item});
				}
		};

		var unbindDragDropEvents = function(item) {
				item = jQuery(item);
				item
				.unbind("drag", onDrag)
				.unbind("draginit", onDragInit)
				.unbind("dragstart", onDragStart)
				.unbind("dragend", onDragEnd)
				.unbind("dropstart")
				.unbind("dropend")
				.unbind("drop")
				.data("ddBound",false);

				hooks.doHooks("unbind", {item : item});
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
						bindDragDropEvents(node);
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
						container.children("li").each(function(i,e){
								bindDragDropEvents(e);
						});
				},

				expand : function(event) {
						//db.log(db.LogLevel.INFO, "expanding pile %o %o",event.data.pile, self);
						dragBlocker.doIfNotBlocked(function(){
								var pile = event.data.pile;
								pile.get(0).timeout = setTimeout(function(){
										jQuery(event.data.pile).addClass("expanded");

										event.data.pile.children().each(function(i,e){
												bindDragDropEvents(e);
										});

								}, self.params.groupExpandDelay);
						});
				},

				collapse : function(event) {
						//db.log(db.LogLevel.INFO, "collapsing pile %o %o", event.data.pile, event.data.pile.timeout);
						dragBlocker.doWhenNotBlocked(function(){
								clearTimeout(event.data.pile.get(0).timeout);
								event.data.pile.children().each(function(i,e){
										unbindDragDropEvents(e);
								});
								jQuery(event.data.pile).removeClass("expanded");
						});
				},

				//TODO clone rather than re-wrap
				group	:	function(dropped, target) {
						var pile = target.children("ul");
						if (!pile.length) {
								target.addClass("pile")
								.children().wrapAll(jQuery("<ul class='group'></ul>"))
								.wrap(jQuery("<li class='node'>"))

								pile = target.children("ul");

								pile
								.bind("mouseenter", {
										pile : pile
								}, db.dragPad.expand)
								.bind("mouseleave", {
										pile : pile
								}, db.dragPad.collapse)
						}
						
						var group = dropped.children(".group");
						var items = group.length ? group.children("li") : dropped;
						moveNode(items, pile);

						var j = 5;
						var items = pile.children();
						for (var i = items.length; i>0; i--) {
								var item = jQuery(items[i-1]);
								if (j > 0) {
										item.css("top", (j*3)+"px");
										item.css("left", (j*3)+"px");
										j--;
								}
						}
						hooks.doHooks("group", {item : pile});
						return dropped;
				},

				ungroup : function(item, group, positionRef) {
						positionRef = positionRef || container;
						moveNode(item, container, positionRef);

						if (group.children().length <= 1) {
								moveNode(group.children().first(), container, group.parent());
								group.parent().remove();
						}
						hooks.doHooks("ungroup", {group : group});
				},
				
				getHooks : function() {
						return hooks;
				}
		}
}());