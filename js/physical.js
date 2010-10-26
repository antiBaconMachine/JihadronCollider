db.physical = {
		Collider        :    function(container, params) {
				container = jQuery(container);

				//TODO: don't hardcode widths
				var limit = container.offset();
				limit.bottom = limit.top + container.outerHeight() - 50;
				limit.right = limit.left + container.outerWidth() - 50;

				var self = this;
				var defaults = {
						stepSpeed : 16,
						friction : 0.03,
						minSpeed : 0.2,
						maxSpeed : 100,
						glideCancelTimeout : 100,
						randomMass : false,
						squareSize : 150,
						circularCollisions : true,
						recordData : true
				}
				params = jQuery.extend({},defaults,params);

				var interval;
				var isVolatile;

				var cache = new db.physical.Collider.ElementCache(params);

				if (params.recordData) {
						var runTimes = [];
						var compares = [];
				}

				/**
   * Grid object reduces the ammount of collision tests we need to do by only
   * tracking objects the current item is likely to hit.
   *
   * The grid has to be iterated once per iteration which involves an operation
   * on each item. These setup costs are repayed by the hugely reduced collision
   * tests.
   *
   * Two grids are initated a lower and an upper. The upper grid is offset
   * exactly half the size of the lower so that the intersection of four grid
   * squares occurs in the exact centre of a lower grid square.
   *
   * When building a list of items to test the items location will be determined
   * by the lower grid. Objects it might collide with are determined by the intersecting
   * 4 squares in the upper grid. In this way we ensure that items very close to or on a
   * square border will have sufficient margin. To do this on a single grid the contents of 9 squares
   * (origin and all adjacent) would have to be checked. With two grids we need only
   * check 4.
   */
				var CollisionGrid = function() {
						if (!container.length) {
						//var $container = jQuery(container);
						} else {
								//var $container = container;
								container = container[0];
						}
		
						dims = {
								height : container.offsetHeight,
								width : container.offsetWidth
						};
   
						db.log(db.LogLevel.INFO, "Countainer dims h: %ipx w: %ipx",dims.height, dims.width);

						var buildGrid = function(id, offset) {
								offset = offset || {
										x:0,
										y:0
								};
								var grid = []

								var currentHeight = offset.y;
								var i = 0;
								while (currentHeight < dims.height) {
										var row = [];
										var j = 0;
										var currentWidth = offset.x;
										while (currentWidth < dims.width) {

												row.push({
														grid : id,
														row : i,
														col : j,
														dims : {
																top : currentHeight,
																left : currentWidth,
																size : params.squareSize
														},
														items : []
												})

												currentWidth += params.squareSize;
												j++;
										}
										grid[i]=row;
										currentHeight += params.squareSize;
										i++;
								}
								return grid;
						}

						var reset = function(grid) {
								var rLen = grid.length;
								for (var i = 0 ; i < rLen; i++) {
										var cols = grid[i];
										var cLen = cols.length;
										for (var j = 0; j < cLen; j++) {
												cols[j].items = [];
										}
								}
						}

						/**
	*Resets and populates the upper grid with items and sets a new origin (lower) square
	*reference on each item
	*/
						this.populateGrid = function(items) {
								reset(upperGrid);
								var size = params.squareSize;
								items.each(function(i,e) {
										e = cache.get(e);
										var lRow = Math.floor(e.offset.top / size);
										var lCol = Math.floor(e.offset.left / size);
										var uRow = Math.floor((e.offset.top - upperGrid.offset) / size);
										var uCol = Math.floor((e.offset.left - upperGrid.offset) / size);

										//store ref to lower grid in element
										e.gridRef = lowerGrid[lRow][lCol];
										//store ref to element in upper grid
										upperGrid[uRow][uCol].items.push(e);
								});
						}

						this.getItemsForTest = function(gridRef) {
								var items = [];
								var squares = [];

								//test the 4 upper grid squares which intersect with the origin square
								squares.push(upperGrid[gridRef.row][gridRef.col]);
								squares.push(upperGrid[gridRef.row + 1][gridRef.col]);
								squares.push(upperGrid[gridRef.row][gridRef.col + 1]);
								squares.push(upperGrid[gridRef.row + 1][gridRef.col + 1]);

								for (var i=squares.length-1; i >= 0; i--) {
										items = items.concat(squares[i].items);
								}
								return items;
						}

						var lowerGrid = buildGrid("lower");
						var o = (params.squareSize/2)*-1;
						var upperGrid = buildGrid("upper", {
								x : o,
								y : o
						});
						upperGrid.offset = o;

				}

				var grid = new CollisionGrid(container);
				
				var run = function() {
						var startTime = new Date();
						var items = jQuery("#items").children();
						var compareCount=0;
						grid.populateGrid(items);
						isVolatile = false;

						var len = items.length;
						for(var i = 0; i < len; i++) {
								var e1 = cache.get(items.get(i));
								if (e1.projectile.isMoving()) {
										isVolatile = true

										move(e1);
										hitWall(e1);
										e1.projectile.applyFriction();

										var candidates = grid.getItemsForTest(e1.gridRef);
										var tested = []
										for (var j=candidates.length-1; j >= 0; j--) {

												var e2 = candidates[j];
												//TODO ensure elements actually have an id
												if (!tested[e2.element.id] && !e1.equals(e2)) {
														//db.log(db.LogLevel.DEBUG, "Testing %s against %s", e1.id, e2.id);
														compareCount++;
														if (self.intersects(e1,e2)) {
																//db.log(db.LogLevel.DEBUG, "%o intersects %o", e1,e2);
																if (params.circularCollisions == true) { //Could be string boolean is passed via url
																		circularCollision(e1,e2);
																} else {
																		elasticCollision(e1,e2);
																}
																tame(e1,e2);
														}
												}
												tested[e2.element.id]=true;
										}
								}
								e1.updatePosition();
						}
						if (params.recordData) {
								runTimes.push(new Date().getTime()-startTime.getTime());
								compares.push(compareCount / items.length);
						}
						if (!isVolatile) {
								self.stop();
						}
				};

				//Actual velocity swapping happens here
				var elasticCollision = function(e1, e2) {
						if (e2) {
								var p1 = e1.projectile;
								var p2 = e2.projectile;
								var v1 = {
										x : p1.velocity.x,
										y : p1.velocity.y
								}

								p1.velocity.x = doElasticCollision(p1.velocity.x, p2.velocity.x, p1.mass, p2.mass);
								p1.velocity.y = doElasticCollision(p1.velocity.y, p2.velocity.y, p1.mass, p2.mass);

								p2.velocity.x = doElasticCollision(p2.velocity.x, v1.x, p1.mass, p2.mass);
								p2.velocity.y = doElasticCollision(p2.velocity.y, v1.y, p1.mass, p2.mass);

						}
				}
				var doElasticCollision = function(u1, u2, m1, m2) {
						return (u1*(m1-m2) + (2*m2*u2))  / (m1+m2);
				}

				var circularCollision = function(e1, e2) {
						var nX1 = e1.nextOffset.left;
						var nY1= e1.nextOffset.top;
						var nDistX = e2.nextOffset.left - nX1;
						var nDistY = e2.nextOffset.top - nY1;

						var nDistance = Math.sqrt ( nDistX * nDistX + nDistY * nDistY );
						var nRadiusA = e1.element.nextOffsetWidth/2;
						var nRadiusB = e2.element.nextOffsetWidth/2;
						//var nRadius:Number = 10;

						var nNormalX = nDistX/nDistance;
						var nNormalY= nDistY/nDistance;

						var nMidpointX = ( nX1 + e2.nextOffset.left )/2;
						var nMidpointY= ( nY1 + e2.nextOffset.top )/2;

						/*	e1.nextOffset.left = nMidpointX - nNormalX * nRadiusA;
						e1.nextOffset.top = nMidpointY - nNormalY * nRadiusA;
						e2.nextOffset.left = nMidpointX + nNormalX * nRadiusB;
						e2.nextOffset.top = nMidpointY + nNormalY * nRadiusB;*/

						var nVector = ( ( e1.projectile.velocity.x - e2.projectile.velocity.x ) * nNormalX )+ ( ( e1.projectile.velocity.y - e2.projectile.velocity.y ) * nNormalY );
						var nVelX = nVector * nNormalX;
						var nVelY= nVector * nNormalY;

						e1.projectile.velocity.x -= nVelX;
						e1.projectile.velocity.y -= nVelY;
						e2.projectile.velocity.x += nVelX;
						e2.projectile.velocity.y += nVelY;
				}

				var move = function(e) {
						var proj = e.projectile;
						e.saveOffset();
						var pos = e.nextOffset;

						var chooseInverse = function(s,max){
								return Math.max(s,max*-1)
						};
						var chooseX = proj.velocity.x >= 0 ? Math.min : chooseInverse;
						var chooseY = proj.velocity.y >= 0 ? Math.min : chooseInverse;

						pos.left = pos.left + chooseX(proj.velocity.x, params.maxSpeed);
						pos.top = pos.top + chooseY(proj.velocity.y, params.maxSpeed);

				//db.log(db.LogLevel.DEBUG, "position of %o is %o",e,coords);
				}

				//essentially a run on from move
				var hitWall = function(e) {

						var hitX = true;
						var hitY = true;

						var fudge = 7;

						if(e.nextOffset.left < limit.left) {
								e.nextOffset.left = limit.left + fudge;
						}else if((e.nextOffset.left) > limit.right) {
								e.nextOffset.left = limit.right;
						} else {
								hitX = false;
						}

						if (e.nextOffset.top < limit.top) {
								e.nextOffset.top = limit.top + fudge;
						} else if ((e.nextOffset.top ) > limit.bottom) {
								e.nextOffset.top = limit.bottom;
						} else {
								hitY = false;
						}

						//db.log(db.LogLevel.INFO, "Hits x: %b y: %b",hitX,hitY);
						if (hitX) {
								e.projectile.velocity.x *= -1;
						}
						if (hitY) {
								e.projectile.velocity.y *= -1;
						}
						return hitX || hitY;
				}

				/*When an item has passed into abother reset it to it's last position
   *hopefully this will happen fast enough that the user won't notice
   *we're totally cheating :)
   */
				var tame = function(e1, e2) {
						e1.nextOffset = e1.offset;
				}

				var onDragInit = function(e) {
						return function(ev, dd) {
								dd.wrappedElement = self.getElement(e.get(0));
								dd.wrappedElement.projectile.velocity = {
										x:0,
										y:0
								};
						};
				};
				var onDrag = function(ev, dd) {
						dd.wrappedElement.projectile.update({
								x : dd.offsetX,
								y : dd.offsetY
						});
				};
				var onDragEnd = function(ev, dd) {
						dd.wrappedElement.projectile.calcVelocity();
						dd.wrappedElement.refresh();
						self.start();
				};

				//****PUBLIC COLLIDER FUNCTIONS*******//

				this.bindHandlers = function(args) {
						var initHandler = onDragInit(args.item)
						args.item.data("physicalDragInit",initHandler);
						args.item
						.drag("init", onDragInit(args.item))
						.drag(onDrag)
						.drag("end", onDragEnd)
				};
				this.unbindHandlers = function(args) {
						args.item
						.unbind("dragInit", args.item.data("physicalDragInit"))
						.unbind("drag", onDrag)
						.unbind("dragEnd", onDragEnd);
				}

				this.getElement = cache.get;

				this.calcMass = function(args) {
						var item = args.item;
						if (item) {
								var len = item.children().length;
								if (len) {
										//TODO DOM agnostic way of finding the correct element
										var e = self.getElement(item.parent());
										e.projectile.setMass(len);
										e.projectile.velocity = {
												x:0,
												y:0
										};
								}
						}
				};

				this.step = function() {
						run();
				};
				this.start = function() {
						if (!interval) {

								if (params.profile) {
										console.profile("running collider");
								}
								interval = setInterval(run, params.stepSpeed);
						}
						if (params.recordData) {
								jQuery("#fps").html("");
								jQuery("#compares").html("");
						}
				};

				this.stop = function() {
						clearInterval(interval);
						interval = null;
						if (params.profile) {
								console.profileEnd();
						}

						if (params.recordData) {
								var av = db.util.average(runTimes);
								var fps = Math.round(1000/av);
								db.log(db.LogLevel.INFO, "Collider has stopped, average pass time: %i (%ifps)",av,fps);
								jQuery("#fps").html("<h1>~"+fps+"fps</h1>");
								jQuery("#compares").html("<h1>~"+Math.round(db.util.average(compares)*100)/100+" comp</h1>");
						}
				};

				this.intersects = function(e1, e2) {

						var o1 = e1.nextOffset;
						var o2 = e2.nextOffset;

						var x1 = o1.left, y1 = o1.top,
						w1 = e1.element.offsetWidth, h1 = e1.element.offsetHeight,
						x2 = o2.left, y2 = o2.top,
						w2 = e2.element.offsetWidth, h2 = e2.element.offsetHeight;

						return !(y2 + h2 < y1 || y1 + h1 < y2 || x2 + w2 < x1 || x1 + w1 < x2);
				};

				if (db.logLevel) {
						this.getElements = function() {
								return cache.getElements();
						}
				};
		}
}

db.physical.Collider.Projectile = function(element, params, velocity) {
		var history = [];
		var timeout;

		this.velocity = (velocity ? velocity :{
				x : 0,
				y : 0
		});

		this.applyFriction = function() {
				var f = (1-(params.friction * this.mass));
				if (f<0) f=0;

				this.velocity.x = this.velocity.x * f;
				this.velocity.y = this.velocity.y * f;
		};
		this.update = function(pos) {
				clearTimeout(timeout);
				history.push(pos);
				if (history.length > (200 / params.stepSpeed)) {
						history = history.slice(1);
				}
				timeout = setTimeout(function(){
						history=[]
				}, params.glideCancelTimeout);
		};
		this.calcVelocity = function() {
				if (history.length > 1) {
						this.velocity = this.averageSpeed(history);
				}
				db.log(db.LogLevel.DEBUG, "velocity is %i %i",this.velocity.x, this.velocity.y);
		};
		this.setMass = function(mass) {
				if (params.randomMass){
						mass += (Math.random()-0.5)/2;
				}
				this.mass = mass;
		};
		this.isMoving = function() {
				return Math.abs(this.velocity.x) > params.minSpeed
				&& Math.abs(this.velocity.y) > params.minSpeed
		};
		this.averageSpeed = function(history) {
				var samples = history.length-1;
				var velocity = {
						x : 0,
						y : 0
				}
				if (samples) {
						velocity = ( function(head, tail, acc) {
								var nextHead = history.pop();
								velocity.x += (head.x - nextHead.x) / samples;
								velocity.y += (head.y - nextHead.y) / samples;
								if (tail.length) {
										return arguments.callee(nextHead,tail, velocity);
								}
								return velocity;
						}(history.pop(), history, velocity) )
				}
				return velocity;
		};

		this.setMass(1);
		element.data("physical",this);
};

db.physical.Collider.ElementCache = function(params) {
		var elements ={}

		this.get = function(element) {
				if (element.length) element = element[0];
				var id = element.id;
				if (!id) {
						id = db.util.generateID("node");
						element.id = id;
				}

				var we = elements[id];
				if (!we) {
						we = new db.physical.Collider.WrappedElement(element, params);
						elements[id] = we;
				}
				return we;
		}

		if (db.logLevel) {
				this.getElements = function() {
						return elements;
				}
		}
};


//TODO effective use of params
db.physical.Collider.WrappedElement = function(element, params){
		this.element = element;
		this.$element = jQuery(element);
		this.offset = this.$element.offset();
		this.nextOffset = this.offset;
		this.projectile = this.$element.data("physical");
		if(!this.projectile) {
				this.projectile = new db.physical.Collider.Projectile(this.$element, params);
		}
};
db.physical.Collider.WrappedElement.prototype = {
		refresh : function() {
				this.offset = this.$element.offset();
				this.nextOffset = this.offset;
				return this;
		},
		equals : function(w2) {
				return this.element === w2.element;
		},
		addOffset : function(of) {
				this.offset = {
						top : this.offset.top + of.top,
						left : this.offset.left + of.left
				}
				this.$element.offset(this.offset);
		},
		saveOffset : function() {
				this.nextOffset = {
						top : this.offset.top,
						left : this.offset.left
				}
		},
		updatePosition : function() {
				if ((this.offset.top != this.nextOffset.top) ||
						(this.offset.left != this.nextOffset.left)) {

						this.$element.offset(this.nextOffset);
						this.offset = this.nextOffset;
				}
		},
		getTheta : function() {
				return Math.atan((this.nextOffset.left - this.offset.left) / (this.nextOffset.top - this.nextOffset.top));
		}
};