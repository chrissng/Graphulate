/*
 * MPivotGraph - JavaScript PivotGraph module v0.2
 * 
 * JSON dataset - provide node/link properties highlighted below for better user experience 
 	{ 
 		"links" : [ 
    		{ 
    			"rsDisplay" : "bla bla", 	// description/label of link
    			"source" : 0, 
    			"target" : 2,				// source & target attributes are elements in the nodes array, specified as indexes into the nodes array
    			"value" : 10 				// tentative feature: value attribute contributes to the weight/thickness of the link
    			... 
    		}, 
    		...
      	],
      	"nodes" : [ 
			{ 
		        "oid" : "0asq21kp",			// a unique identifier (alpha and/or numeric)
		        "name" : "孙门张氏千娘 曾祖母"	// if node is to be listed in the "i am who?" drop-down list
		    },
		    ...
		]
    }
 *
 * Based on Mike Bostock's Gist https://gist.github.com/mbostock/4343153
 * Requires D3.js (https://github.com/mbostock/D3)
 */

var MPivotGraph = MPivotGraph || ( function() { // JS Module pattern (singleton)

	var rollup = function() {
		var directed = true,
			x_ = rollupX,
			y_ = rollupY,
			nodes_ = rollupNodes,
			links_ = rollupLinks,
			linkValue = rollupLinkValue,
			linkSource = rollupLinkSource,
			linkTarget = rollupLinkTarget;

		var rollup = function(d, i) {
			var nodes = nodes_.call(this, d, i),
			    links = links_.call(this, d, i),
			    n = nodes.length,
			    m = links.length,
			    i = -1,
			    x = [],
			    y = [],
			    rnindex = 0,
			    rnodes = {},
			    rlinks = {};

			// Compute rollup nodes.
			while (++i < n) {
				(d = nodes[i]).index = i;
				x[i] = x_.call(this, d, i);
				y[i] = y_.call(this, d, i);
				var nodeId = id(i),
					rn = rnodes[nodeId];
				if (!rn) {
					rn = rnodes[nodeId] = {
						index: rnindex++,
						x: x[i],
						y: y[i],
						nodes: [],
						//key: String((axisNormal) ? xAxis : yAxis)+"_"+String((axisNormal) ? yAxis : xAxis)+"_"+(rnindex-1)
						key: String((axisNormal) ? xAxis : yAxis)+"_"+String((axisNormal) ? yAxis : xAxis)+"_"+(nodes[i].oid.replace(escapeRegex, "_"))
						//String(((axisNormal) ? d[xAxis] : d[yAxis])).replace(/ /g, "_").toUpperCase()+"_____"+String(((axisNormal) ? d[yAxis] : d[xAxis])).replace(/ /g, "_").toUpperCase()
					};
				}
				rn.nodes.push(d);
			}

			// Compute rollup links.
			i = -1; while (++i < m) {
			  	var value = linkValue.call(this, d = links[i], i),
					source = linkSource.call(this, d, i),
					target = linkTarget.call(this, d, i),
					rsource = rnodes[id(typeof source === "number" ? source : source.index)],
					rtarget = rnodes[id(typeof target === "number" ? target : target.index)],
					linkId = !directed && rsource.index > rtarget.index
								? rtarget.index + "," + rsource.index
								: rsource.index + "," + rtarget.index,
					rl = rlinks[linkId];
				if (!rl) {
					rl = rlinks[linkId] = {
					  source: rsource,
					  target: rtarget,
					  value: 0,
					  links: []
					};
				}
		  		rl.links.push(links[i]);
		  		rl.value += value;
			}

			return {
				nodes: d3.values(rnodes),
				links: d3.values(rlinks)
			};

			function id(i) {
				return x[i] + "," + y[i];
			}
		};

		rollup.x = function(x) {
			if (!arguments.length) return x_;
			x_ = x;
			return rollup;
		};

		rollup.y = function(x) {
			if (!arguments.length) return y_;
			y_ = x;
			return rollup;
		};

		rollup.nodes = function(x) {
			if (!arguments.length) return nodes_;
			nodes_ = x;
			return rollup;
		};

		rollup.links = function(x) {
			if (!arguments.length) return links_;
			links_ = x;
			return rollup;
		};

		rollup.linkSource = function(x) {
			if (!arguments.length) return linkSource;
			linkSource = x;
			return rollup;
		};

		rollup.linkTarget = function(x) {
			if (!arguments.length) return linkTarget;
			linkTarget = x;
			return rollup;
		};

		rollup.linkValue = function(x) {
			if (!arguments.length) return linkValue;
			linkValue = x;
			return rollup;
		};

		rollup.directed = function(x) {
			if (!arguments.length) return directed;
			directed = x;
			return rollup;
		};

		return rollup;

		function rollupX(d) { return d.x; }
		function rollupY(d) { return d.y; }
		function rollupNodes(d) { return d.nodes; }
		function rollupLinks(d) { return d.links; }
		function rollupLinkValue(d) { return 1; }
		function rollupLinkSource(d) { return d.source; }
		function rollupLinkTarget(d) { return d.target; }
	};

	var escapeRegex = / |\#|\.|\>|\<|\,|\:|\/|\)|\(|\'|\"|\-|\n|\r|\&|\*|\@/g;

	// Interactions
	var numOfAnimations = 0;
	var animationsHappening = false;
	var animation = true;
	var animationDuration = 1000;
	var mouseDragThreshold = 5;
	//var zoomOffsetA = [];
	//var zoomOffsetB = [];

	// Visuals
	var defaultOpacity = 0.2;
	var mainColor = "#FFF";//"#E6C091";
	var nodeColor = "#555";//"#563411";
	var leafNodeColor = "#BBB";
	var targetNodeColor = "#FFF";//"#E6C091";
	var semiTargetNodeColor = "#888";//"#E0A969";
	var gridLineColor = "#1E1E1E";//"#FFFFFF";
	var mustColorNodes = true;

	// Dimensions
	var w = 600;
	var h = 600;
	var p = 30+50; // y-offset for pivotgraph
	var nodeSizeFactor = 40;
	var linkThicknessFactor = 2;
	var strokeWidth = 1;
	var arcFactor = 2; // the smaller, the more it is arched

	// Data
	var axisNormal = true; // normal or reversed
	var xAxis, yAxis;
	var targetId = -1;
	var inData = {};

	var endall = function(transition, callback) {
		if (transition.empty()) {
			//animationsHappening = false; // only for this transition, does not mean all transitions
			if (callback) callback.apply(this, arguments);
		} else {
			transition
				.each(function() {
					animationsHappening = animation;
					++numOfAnimations;
				})
				.each("end", function() {
					if (!--numOfAnimations) {
						animationsHappening = false;
						if (callback) callback.apply(this, arguments); 
					}
				});
		}
	};

	var arcLink = function(d) {
		var tx = d.target.x,
			sx = d.source.x,
			ty = d.target.y,
			sy = d.source.y,
			dx = tx - sx,
			dy = ty - sy,
			dr = arcFactor * Math.sqrt(dx * dx + dy * dy);
		return "M" + sx + "," + sy + "A" + dr + "," + dr + " 0 0,1 " + tx + "," + ty;
    };

	var opaqueLink = function(d) {
		for (i = 0; i < d.links.length; i++) {
			if ((inData.nodes[d.links[i].source][xAxis] == undefined || inData.nodes[d.links[i].source][yAxis] == undefined) && 
				(inData.nodes[d.links[i].target][xAxis] == undefined || inData.nodes[d.links[i].target][yAxis] == undefined)) 
				return 0.05;
		}
		return defaultOpacity;
	};

	var fillLeafNode = function(d) {
		if (d.oid == targetId) { 
			return targetNodeColor;
		} else if (mustColorNodes) {
			var Color = chooseNodeColor(d);
			if (Color) return Color;
		}
		return leafNodeColor;
	};

	var fillNode = function(d) {
		if (d.nodes.length == 1) {
			if (d.nodes[0].oid == targetId) { 
				return targetNodeColor;
			} else if (mustColorNodes) {
				var Color = chooseNodeColor(d.nodes[0]);
				if (Color) return Color;
			}
		} else if (d.nodes && d.nodes.length > 1) {
			for (var i = 0; i < d.nodes.length; i++) {
				if (d.nodes[i].oid == targetId) return semiTargetNodeColor;
			}
		}

		return nodeColor;
	};

	var strokeNode = function(d) {
		if (d.nodes && d.nodes.length == 1 && mustColorNodes) {
			var Color = chooseNodeColor(d.nodes[0]);
			if (Color) return Color;
		} else if (mustColorNodes) {
			var Color = chooseNodeColor(d);
			if (Color) return Color;
		}
		return mainColor;
	};

	var chooseNodeColor = function(d) {
		if (d.gender == "male") {
			return "#2980b9";
		} else if (d.gender == "female") {
			return "#e74c3c";
		}
		return null;
	};

	var emphasizeAxleLabels = function(d, emphasize) {
		var graphId = MPivotGraph.graphId;
		var emphasizeSz = 20;

		var dimCSSSelector = 
			"svg#"+graphId+" g#"+graphId+"_graph text."+graphId+"_y, svg#"+graphId+" g#"+graphId+"_graph text."+graphId+"_x";
		((!animation) ?  
			d3.selectAll(dimCSSSelector) : 
			d3.selectAll(dimCSSSelector)
				.transition().duration(animationDuration*0.2))
			.style("opacity", function(d) {
				if (d3.select(this).attr("id") == graphId+"_y_"+"UNDEFINED" || d3.select(this).attr("id") == graphId+"_x_"+"UNDEFINED") {
					return 0.1;
				} else {
					return (emphasize ? 0.5 : 1);
				}
			})
			.attr("font-size", emphasizeSz/2);

		var emphasizeCSSSelector = 
			"svg#"+graphId+" g#"+graphId+"_graph text#"+graphId+"_y_"+String(d[yAxis]).toUpperCase().replace(escapeRegex, "_")+
			", svg#"+graphId+" g#"+graphId+"_graph text#"+graphId+"_x_"+String(d[xAxis]).toUpperCase().replace(escapeRegex, "_");
		((!animation) ?  
			d3.selectAll(emphasizeCSSSelector) : 
			d3.selectAll(emphasizeCSSSelector)
				.transition().duration(animationDuration*0.2))
			.style("opacity", function(d) {
				if (d3.select(this).attr("id") == graphId+"_y_"+"UNDEFINED" || d3.select(this).attr("id") == graphId+"_x_"+"UNDEFINED") {
					return 0.1;
				} else {
					return 1.0;
				} 
			})
			.attr("font-size", (emphasize ? emphasizeSz : emphasizeSz/2));
	};

	var showTooltip = function(divId, graphId, textStuff, duration) {
		var tooltip = d3.select("div#"+divId+" div#"+graphId+"_tooltip")
		if (tooltip.node() == null) {
			tooltip = d3.select("div#"+divId).append("div").attr("id", graphId+"_tooltip");
		}

		var textDesc = textStuff;
		var dataProperty = MPivotGraph.dataProperty;
		if (typeof textStuff == "object") {
			textDesc = "<table cellpadding='0'>";
			for (key = 0; key < dataProperty.length; key++) {
				textDesc += 
						"<tr><td valign='top' style='font-weight:bold;'>" + 
							dataProperty[key].trim() + 
						"</td><td valign='top' style='padding-left:15px;'>" + 
							((textStuff[dataProperty[key]] == undefined) ? "<div style='opacity:0.3;'>nil</div>" : String(textStuff[dataProperty[key]]).trim()) + 
						"</td></tr>";
			}
			/*if (MPivotGraph.Scores && textStuff.type && textStuff.type.trim().toUpperCase() == "EVENT") {
				textDesc += "<tr><td valign='top' style='font-weight:bold;'> score</td><td valign='top' style='padding-left:10px;'>" + 
							MPivotGraph.Scores[textStuff.oid] + "</td></tr>";
			}*/
			textDesc += "</table>";
		}

		tooltip.style("position", "absolute")
				.style("bottom", "0px")
				.style("left", "0px")
				.style("padding", "10px")
				.style("text-shadow", "1px 1px #000")
				.style("text-transform", "uppercase")
				.style("pointer-events", "none")
				.style("background-color", "rgba(0, 0, 0, 0.8)")
				.html(textDesc);

		tooltip.transition().delay((duration != undefined ? duration : 1000)).remove();
	};

	return {
		reverseAxis: function() {
			axisNormal = !axisNormal;
		},

		enableAnimation: function() {
			animation = true;
		}, 

		disableAnimation: function() {
			animation = false;
		},

		resizeNode: function(graphId, newNodeSize) {
			if (!graphId || !newNodeSize || newNodeSize < 5) return;

			nodeSizeFactor = newNodeSize;

			var vis = d3.select("svg#"+graphId+" g g#"+graphId+"_graph");
			var visNode = vis.select("g#"+graphId+"_graph_node").selectAll("circle");
			visNode.transition().duration((animation) ? animationDuration*0.2 : 0)
		   			.attr("r", function(d) { return Math.sqrt(d.nodes.length * nodeSizeFactor) / d3.select("svg#"+graphId).attr("data-transform-scale"); });

	   		((!animation) ? 
				d3.selectAll("g#"+graphId+"_leafnodes") : 
				d3.selectAll("g#"+graphId+"_leafnodes").transition().ease("cubic-out").duration(animationDuration*0.2))
				.style("opacity", 0)
				.each("end", function() {
					d3.select(this).remove();
				});
		},

		resetLooks: function(graphId, inData, dontHideLeafNodes) {
			if (animationsHappening) return;

			((!animation) ?  
				d3.selectAll("svg#"+graphId+" circle[id^="+graphId+"_node_]") : 
				d3.selectAll("svg#"+graphId+" circle[id^="+graphId+"_node_]").transition().duration(animationDuration*0.2))
				.style("stroke-width", strokeWidth)
				.style("stroke", strokeNode);

			((!animation) ?  
				d3.selectAll("svg#"+graphId+" path[id^="+graphId+"_path_]") : 
				d3.selectAll("svg#"+graphId+" path[id^="+graphId+"_path_]").transition().duration(animationDuration*0.2))
	    		.style("opacity", opaqueLink)
	    		.style("stroke-dasharray", null)
					.style("stroke-dashoffset", 0);

			if (!dontHideLeafNodes) {
				((!animation) ? 
					d3.selectAll("g#"+graphId+"_leafnodes") : 
					d3.selectAll("g#"+graphId+"_leafnodes").transition().ease("cubic-out").duration(animationDuration*0.2))
					.style("opacity", 0)
					.each("end", function() {
						d3.select(this).remove();
					});
			}
		},

		build: function(graphId, newTargetId, newInData, xAxisVal, yAxisVal) {
			inData = newInData;
			targetId = (newTargetId) ? newTargetId : targetId;
			numOfAnimations = 0;

			xAxis = (axisNormal) ? xAxisVal : yAxisVal;
			yAxis = (axisNormal) ? yAxisVal : xAxisVal;


			var fx = function(d) { 
				return String(d[xAxis]).trim().toUpperCase(); 
			};
			var fy = function(d) { 
				return String(d[yAxis]).trim().toUpperCase(); 
			};
			// var fType = function(d) { 
				// return {
					// data: String(d[yAxis]).trim().toUpperCase(),
					// type: String(d.order).trim().toUpperCase(),
				// };
			// };


			var x = d3.scale.ordinal().domain(inData.nodes.map(fx).sort(d3.ascending)).rangePoints([0, w]);
			var y = d3.scale.ordinal().domain(inData.nodes.map(fy).sort(d3.ascending)).rangePoints([0, h]);
			// var y = d3.scale.ordinal().domain((function() {
				// var domainlist = [];
				// var domainObjList = inData.nodes.map(fType).sort(function(a, b) { return d3.descending(a.type+a.data, b.type+b.data); });

				// for (key = 0; key < domainObjList.length; key++) {
					// domainlist.push(domainObjList[key].data);
				// }
				// return domainlist;
			// })()).rangePoints([0, h]);


			var layout = rollup(xAxis, yAxis)
			    .x(function(d) { return x(fx(d)); })
			    .y(function(d) { return y(fy(d)); });
			// var layout = rollup(xAxis, yAxis)
			    // .x(function(d) { 
			    	// return x(fx(d));
			    // })
			    // .y(function(d) { 
			    	// return y(fType(d).data);
			    // });


			var g = layout(inData);



			  ///////////////////
			 ///  CONTAINER  ///
			///////////////////

			if (d3.select("svg#"+graphId).select("g").select("g").node() == null) {
				// create svg containers if they do not exist

				d3.selectAll("svg#"+graphId+" *").remove();
				var topContainer = d3.select("svg#"+graphId)
										.style("width", "100%")
										.attr("data-transform-scale", 1.0)
										//.style("height", w + 2 * p + "px")
										.call(d3.behavior.zoom()
											.scaleExtent([0.7, 20])
											/*
											.on("zoomstart", function() {
												zoomOffsetA = d3.event.target.translate();
											})*/
											.on("zoomend", function() {
												MPivotGraph.resetLooks(graphId, inData);
												/*return; 
												
												zoomOffsetB = d3.event.target.translate();

												var aSq = Math.pow(Math.abs(zoomOffsetA[0] - zoomOffsetB[0]),2);
												var bSq = Math.pow(Math.abs(zoomOffsetA[1] - zoomOffsetB[1]),2);
												var c = Math.sqrt(aSq + bSq);

												if (c <= mouseDragThreshold) {
													MPivotGraph.resetLooks(graphId, inData);
												}*/
											})
											.on("zoom", function() {
												if (animationsHappening) return;

												var d = d3.event.translate;
												if (d3.select(this).attr("data-transform-scale") == d3.event.scale) {
													console.log("panning");
													//MPivotGraph.resetLooks(graphId, inData);
												} else {
													console.log("zooming");
												}

												d3.select(this).attr("data-transform-scale", d3.event.scale);
												
												((!animation) ? 
													d3.select("svg#"+graphId+" g") : 
													d3.select("svg#"+graphId+" g").transition().ease("cubic-out").duration(animationDuration*0.2))
													.attr("transform", "translate("+d+")scale("+d3.event.scale+")");

												((!animation) ? 
													d3.selectAll("svg#"+graphId+" circle[id^="+graphId+"_node_]") : 
													d3.selectAll("svg#"+graphId+" circle[id^="+graphId+"_node_]").transition().ease("cubic-out").duration(animationDuration*0.2))
													.attr("r", function(d) { return Math.sqrt(d.nodes.length * nodeSizeFactor)/d3.event.scale; });
												
												((!animation) ? 
													d3.selectAll("svg#"+graphId+" path[id^="+graphId+"_path_]") : 
													d3.selectAll("svg#"+graphId+" path[id^="+graphId+"_path_]").transition().ease("cubic-out").duration(animationDuration*0.2))
													.style("stroke-width", function(d) { return d.value * linkThicknessFactor / d3.event.scale; });

												((!animation) ? 
													d3.selectAll("g#"+graphId+"_leafnodes") : 
													d3.selectAll("g#"+graphId+"_leafnodes").transition().ease("cubic-out").duration(animationDuration*0.2))
													.style("opacity", 0)
													.each("end", function() {
														d3.select(this).remove();
													});
											})
										)
										.append("g"); // for drag and zoom
				topContainer.append("g")
					.attr("id", graphId+"_grid")
					.attr("transform", "translate(" + [((d3.select("svg#"+graphId).node().clientWidth-w)/2), p] + ")");
				var graphContainer = topContainer.append("g")
					.attr("id", graphId+"_graph")
					.attr("transform", "translate(" + [((d3.select("svg#"+graphId).node().clientWidth-w)/2), p] + ")");

				graphContainer.append("g")
					.attr("id", graphId+"_graph_link");
				graphContainer.append("g")
					.attr("id", graphId+"_graph_node");	
			}

			var vis = d3.select("svg#"+graphId+" g g#"+graphId+"_graph");



			  ///////////////////
			 ///    LINKS    ///
			///////////////////

			var visLink = vis.select("g#"+graphId+"_graph_link").selectAll("path").data(g.links, function(d) { return d.source.key + "_" + d.target.key; });
			visLink.interrupt().transition();
			// UPDATE
			((!animation) ? 
				visLink : 
				visLink.transition().duration(animationDuration).call(endall))
				.style("stroke-width", function(d) { return d.value * linkThicknessFactor / d3.select("svg#"+graphId).attr("data-transform-scale"); })
			    .attr("d", arcLink)
			    .style("opacity", opaqueLink)
				.style("stroke-dasharray", null)
			    .style("stroke-dashoffset", 0);
			// ENTER
			visLink.enter().append("path")//.transition().delay(animationDuration)
				.attr("id", function(d) { return graphId+"_path_"+d.source.index+"_"+d.target.index; })
				.attr("class", function(d) {
					var allNodes = d.links;
					var nodeClassNames = "";
					for (var i = 0; i < allNodes.length; i++) nodeClassNames += " idx" + allNodes[i].source + " idx" + allNodes[i].target;
					return nodeClassNames.trim();
				})
				.style("pointer-events", "visiblepainted")
				.style("fill", "none")
				.style("stroke", mainColor)
				.style("opacity", opaqueLink)
			    .style("stroke-width", function(d) { return d.value * linkThicknessFactor / d3.select("svg#"+graphId).attr("data-transform-scale"); })
				//.style("vector-effect", "non-scaling-stroke") // not using this because zooming out causes "clipping" of path to bbox
			    .attr("d", arcLink)
			    .style("stroke-dasharray", function(d) { return this.getTotalLength() + " " + this.getTotalLength(); })
			    .style("stroke-dashoffset", function(d) { return (animation) ? this.getTotalLength() : 0; })
			    .transition().delay(animationDuration).duration((animation) ? animationDuration : 0)
			    .style("stroke-dashoffset", 0)
				.each(function(d) {
					// Link interaction stuffs

					if (numOfAnimations) numOfAnimations++;
					else numOfAnimations = 1;
					animationsHappening = animation;

					d3.select(this)
						.on("mouseover", function(d) {
							if (animationsHappening) return;
							//MPivotGraph.resetLooks(graphId, inData);

					    	((!animation) ?  
								d3.selectAll("circle#"+graphId+"_node_"+d.source.index+","+"circle#"+graphId+"_node_"+d.target.index) : 
								d3.selectAll("circle#"+graphId+"_node_"+d.source.index+","+"circle#"+graphId+"_node_"+d.target.index)
									.transition().duration(animationDuration*0.2))
					    		.style("stroke-width", 3)
					    		.style("stroke", mainColor);
					    		
					    	((!animation) ?  
								d3.select(this) : 
								d3.select(this).transition().duration(animationDuration*0.2))
								.style("opacity", 0.9)
								.style("stroke-dasharray", null)
			   					.style("stroke-dashoffset", 0)
			   					.style("cursor", "pointer");

			   				if (d.links && d.links.length == 1 && d.links[0].rsDisplay) {
			   					var source = MPivotGraph.rawData.nodes[d.links[0].source];
			   					var target = MPivotGraph.rawData.nodes[d.links[0].target];
			   					showTooltip(MPivotGraph.divId, graphId, 
			   						"<div>" + 
			   							((source.name == "Article") ? source.articleName : source.name) + 
			   							"&nbsp;&nbsp;&nbsp;<b style='font-style:italic;'>" + d.links[0].rsDisplay + "</b>&nbsp;&nbsp;&nbsp;" + 
			   							((target.name == "Article") ? target.articleName : target.name) + 
			   						"</div>"
			   					, 5000);
			   				}
						})
						.on("mouseout", function(d) {
							if (animationsHappening) return;

							((!animation) ?  
								d3.selectAll("circle#"+graphId+"_node_"+d.source.index+","+"circle#"+graphId+"_node_"+d.target.index) : 
								d3.selectAll("circle#"+graphId+"_node_"+d.source.index+","+"circle#"+graphId+"_node_"+d.target.index)
									.transition().duration(animationDuration*0.2))
								.delay(animationDuration*2)
					    		.style("stroke-width", strokeWidth)
								.style("stroke", strokeNode);

					    	((!animation) ?  
								d3.select(this) : 
								d3.select(this).transition().duration(animationDuration*0.2))
					    		.delay(animationDuration*2)
					    		.style("fill", "none")
								.style("stroke", mainColor)
								.style("opacity", opaqueLink)
								.style("stroke-dasharray", null)
			   					.style("stroke-dashoffset", 0);
						});
				})
				.each("end", function() { if (!--numOfAnimations) animationsHappening = false; });
			// EXIT
			((!animation) ? 
				visLink.exit() : 
				visLink.exit().transition().duration(animationDuration).call(endall).style("opacity", 0))
				.remove();



			  ///////////////////
			 ///    NODES    ///
			///////////////////
			
			var visNode = vis.select("g#"+graphId+"_graph_node").selectAll("circle").data(g.nodes, function(d) { return d.key; });
			visNode.interrupt().transition();
			// UPDATE
			((!animation) ?  
				visNode : 
				visNode.transition().duration(animationDuration).call(endall))
					.attr("r", function(d) { return Math.sqrt(d.nodes.length * nodeSizeFactor) / d3.select("svg#"+graphId).attr("data-transform-scale"); })
					.attr("cx", function(d) { return d.x; })
			    	.attr("cy", function(d) { return d.y; })
			    	.style("fill", fillNode)
					.style("stroke", strokeNode);
			// ENTER
			visNode.enter().append("circle").transition().delay(animationDuration)
				.attr("id", function(d) { return graphId+"_node_"+d.index; })
				.style("pointer-events", "visiblepainted")
				.style("fill", fillNode)
				.style("stroke", strokeNode)
				.style("vector-effect", "non-scaling-stroke")
			    .attr("cx", function(d) { return d.x; })
			    .attr("cy", function(d) { return d.y; })
				.attr("r", function(d) { return (animation) ? 0 : Math.sqrt(d.nodes.length * nodeSizeFactor); })
				.transition().duration((animation) ? animationDuration*0.2 : 0)
		   			.attr("r", function(d) { return Math.sqrt(d.nodes.length * nodeSizeFactor) / d3.select("svg#"+graphId).attr("data-transform-scale"); })
		   		.each(function(d) {
		   			if (numOfAnimations) numOfAnimations++;
					else numOfAnimations = 1;
					animationsHappening = animation;

					d3.select(this)
						// Node interaction stuffs

						.on("click", function(d) {
							d3.event.stopPropagation();
							if (animationsHappening) return;

							if (d.nodes && d.nodes.length == 1) {
								//alert(d.nodes[0].oid);
								try {
									// do something when node is clicked
								} catch(e) {}
							}
						})
						.on("mouseover", function(d) {
							if (animationsHappening) return;
							//MPivotGraph.resetLooks(graphId, inData);
							
							var parentD = d;
							emphasizeAxleLabels(d.nodes[0], true);

							((!animation) ?  
								d3.select(this) : 
								d3.select(this).transition().duration(animationDuration*0.2))
									.style("cursor", "pointer")
									.style("stroke-width", 3)
									.style("stroke", mainColor);

							((!animation) ?  
								d3.selectAll("svg#"+graphId+" path[id*="+graphId+"_path_"+d.index+"_],"+"svg#"+graphId+" path[id^="+graphId+"_path_][id$=_"+d.index+"]") : 
								d3.selectAll("svg#"+graphId+" path[id*="+graphId+"_path_"+d.index+"_],"+"svg#"+graphId+" path[id^="+graphId+"_path_][id$=_"+d.index+"]")
									.transition().duration(animationDuration*0.2))
					    		.style("opacity", 0.9)
					    		.style("stroke-dasharray", null)
			   					.style("stroke-dashoffset", 0);


							if (d.nodes && d.nodes.length > 1) {
								var diameter = d3.select(this).attr("r")*2;
								var pack = d3.layout.pack()
								    .size([diameter, diameter])
									.value(function(d) { return 1; });

								d3.selectAll("g#"+graphId+"_leafnodes").remove();
								var svgPack = vis.append("g")
												.attr("id", graphId+"_leafnodes")
												.attr("transform", "translate("+(d3.select(this).attr("cx")-d3.select(this).attr("r"))+","+(d3.select(this).attr("cy")-d3.select(this).attr("r"))+")")
												.on("mousemove", function() {
													var svgPack = d3.selectAll("g#"+graphId+"_leafnodes");
													svgPack.interrupt().transition();
													
													svgPack.transition().delay(animationDuration*20).remove();
													/*
													((!animation) ? 
														svgPack.style("opacity", 1).transition().delay(animationDuration) : 
														svgPack.style("opacity", 1).transition().duration(animationDuration))
													.style("opacity", 0).remove();
													*/
												});

								var node = svgPack.datum({"children":d.nodes})
												.selectAll("g").data(function(d) {
													return pack.nodes(d).filter(function (v) {
														return !v.children;
													})
												})
												.enter().append("circle")
													// Leafnode interaction stuffs 

													.on("click", function(d) { 
														d3.event.stopPropagation();
														if (animationsHappening) return;

														try {
															// do something when node is clicked
														} catch(e) {}
													})
													.on("mousemove", function(d) {
														if (animationsHappening) return;
														if (d.children) return;

														//MPivotGraph.resetLooks(graphId, inData, true);

														showTooltip(MPivotGraph.divId, graphId, d);

														emphasizeAxleLabels(d, true);

														d3.select(this)
															.style("cursor", "pointer")
															//.style("stroke-width", 4);
															.style("fill", targetNodeColor);

														((!animation) ?  
															d3.select("circle#"+graphId+"_node_"+parentD.index) : 
															d3.select("circle#"+graphId+"_node_"+parentD.index)
																.transition().duration(animationDuration*0.2))
																.style("cursor", "pointer")
																.style("stroke-width", 3);

														((!animation) ?  
															d3.selectAll("svg#"+graphId+" path[id^="+graphId+"_path_]") : 
															d3.selectAll("svg#"+graphId+" path[id^="+graphId+"_path_]")
																.transition().duration(animationDuration*0.2))
												    		.style("opacity", opaqueLink)
												    		.style("stroke-dasharray", null)
										   					.style("stroke-dashoffset", 0);

														((!animation) ?  
															d3.selectAll("svg#"+graphId+" path[id^="+graphId+"_path_].idx"+d.index) : 
															d3.selectAll("svg#"+graphId+" path[id^="+graphId+"_path_].idx"+d.index)
																.transition().duration(animationDuration*0.2))
															.style("opacity", 0.9)
												    		.style("stroke-dasharray", null)
										   					.style("stroke-dashoffset", 0);

														/*
														((!animation) ?  
															d3.selectAll("svg#"+graphId+" path[id*="+graphId+"_path_"+parentD.index+"_],"+"svg#"+graphId+" path[id^="+graphId+"_path_][id$=_"+parentD.index+"]") : 
															d3.selectAll("svg#"+graphId+" path[id*="+graphId+"_path_"+parentD.index+"_],"+"svg#"+graphId+" path[id^="+graphId+"_path_][id$=_"+parentD.index+"]")
																.transition().duration(animationDuration*0.2))
												    		.style("opacity", 0.9)
												    		.style("stroke-dasharray", null)
										   					.style("stroke-dashoffset", 0);
										   				*/
													})
													.on("mouseout", function(d) {
														if (animationsHappening) return;

														emphasizeAxleLabels(d, false);

														d3.select(this).style("fill", fillLeafNode);

														((!animation) ?  
															d3.select("circle#"+graphId+"_node_"+parentD.index) : 
															d3.select("circle#"+graphId+"_node_"+parentD.index)
																.transition().duration(animationDuration*0.2))
															.style("stroke-width", strokeWidth);

														
														((!animation) ?  
															d3.selectAll("svg#"+graphId+" path[id*="+graphId+"_path_"+parentD.index+"_],"+"svg#"+graphId+" path[id^="+graphId+"_path_][id$=_"+parentD.index+"]") : 
															d3.selectAll("svg#"+graphId+" path[id*="+graphId+"_path_"+parentD.index+"_],"+"svg#"+graphId+" path[id^="+graphId+"_path_][id$=_"+parentD.index+"]")
																.transition().duration(animationDuration*0.2))
												    		.style("opacity", opaqueLink)
												    		.style("stroke-dasharray", null)
										   					.style("stroke-dashoffset", 0);
													})
													.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
													.attr("r", function(d) { return d.r; })
													.attr("class", function(d) {
														if (d.oid == targetId) return "targetLeafNode";
														else return null;
													})
													.style("fill", fillLeafNode)
													.style("fill-opacity", "1")
													.style("stroke", strokeNode)
													.style("stroke-width", function(d) {
														if (d.oid == targetId) {
															return "2px";
														}
														return "0px";
													})
													.style("vector-effect", "non-scaling-stroke")
													//.style("opacity", function(d) { return (animation) ? 0 : ((d.children) ? 0 : 1); })
													//.transition().duration((animation) ? animationDuration*0.2 : 0)
													//.style("opacity", function(d) { return (d.children) ? 0 : 1; });
													.style("opacity", 1)

								node.filter(function(d) { return d.children; }).remove();

								svgPack.transition().delay(animationDuration*20).remove();
								/*
								((!animation) ? 
									svgPack.style("opacity", 1).transition().delay(animationDuration) : 
									svgPack.style("opacity", 1).transition().duration(animationDuration))
								.style("opacity", 0).remove();
								*/
							} else if (d.nodes && d.nodes.length == 1) {
			   					showTooltip(MPivotGraph.divId, graphId, d.nodes[0], 5000);
			   				}
						})
						.on("mouseout", function(d) {
							if (animationsHappening) return;

							emphasizeAxleLabels(d.nodes[0], false);
								
							((!animation) ?  
								d3.select(this) : 
								d3.select(this).transition().duration(animationDuration*0.2))
								.delay(animationDuration*2)
								.style("stroke-width", strokeWidth)				
								.style("stroke", strokeNode);

							((!animation) ?  
								d3.selectAll("svg#"+graphId+" path[id*="+graphId+"_path_"+d.index+"_],"+"svg#"+graphId+" path[id^="+graphId+"_path_][id$=_"+d.index+"]") : 
								d3.selectAll("svg#"+graphId+" path[id*="+graphId+"_path_"+d.index+"_],"+"svg#"+graphId+" path[id^="+graphId+"_path_][id$=_"+d.index+"]")
									.transition().duration(animationDuration*0.2))
								.delay(animationDuration*2)		
					    		.style("opacity", opaqueLink)
					    		.style("stroke-dasharray", null)
			   					.style("stroke-dashoffset", 0);
						});
				})
				.each("end", function() { if (!--numOfAnimations) animationsHappening = false; });
			// EXIT
			((!animation) ? 
				visNode.exit() : 
				visNode.exit().transition().duration(animationDuration*0.2).call(endall).attr("r", 0))
				.remove();

			

			  ///////////////////
			 /// PIVOT AXLES ///
			///////////////////

			vis.selectAll("text."+graphId+"_x").remove();
			var visXAxis = vis.selectAll("text."+graphId+"_x").data(x.domain());
			visXAxis.enter().append("text").style("opacity", 1)
											.style("text-shadow", "1px 1px #000")
											.attr("class", graphId+"_x")
											.attr("id", function(d) { return graphId+"_x_"+d.replace(escapeRegex, "_"); })
										    .attr("text-anchor", "start")
										    .attr("fill", mainColor)
										    .attr("font-size", "10")
										    .text(function(d) {
										    	if (d.toUpperCase() == "UNDEFINED") return "NIL";
										    	else return d;
										    })
										    .attr("transform", function(d) { 
										    	return "translate("+x(d)+", -20)rotate(-45)"; 
										    });
			/* // No fading animations
			((!animation) ? 
					visXAxis : 
					visXAxis.transition().duration(animationDuration*0.2))
					    .style("opacity", function(d) { 
					    	return (d.toUpperCase() == "UNDEFINED") ? 0.1 : 1.0; 
					    });*/

			vis.selectAll("text."+graphId+"_y").remove();
			var visYAxis = vis.selectAll("text."+graphId+"_y").data(y.domain());
			visYAxis.enter().append("text").style("opacity", 1)
											.style("text-shadow", "1px 1px #000")
											.attr("class", graphId+"_y")
											.attr("id", function(d) { return graphId+"_y_"+d.replace(escapeRegex, "_"); })
										    .attr("x", -20)
										    .attr("dy", "0.4em")
										    .attr("y", y)
										    .attr("text-anchor", "end")
										    .attr("fill", mainColor)
										    .attr("font-size", "10")
										    .text(function(d) {
										    	if (d.toUpperCase() == "UNDEFINED") return "NIL";
										    	else return d;
										    });
			/* // No fading animations
			((!animation) ? 
					visYAxis : 
					visYAxis.transition().duration(animationDuration*0.2))
					    .style("opacity", function(d) { 
					    	return (d.toUpperCase() == "UNDEFINED") ? 0.1 : 1.0; 
					    });*/


			
			  ////////////////////
			 ///  GRID LINES  ///
			////////////////////

			var visGrid = d3.select("svg#"+graphId+" g g#"+graphId+"_grid");
			visGrid.selectAll("line[class^="+graphId+"_]").remove();

			var visYLine = visGrid.selectAll("line."+graphId+"_x").data(x.domain());
			visYLine.enter().append("line")
			visYLine.attr("class", graphId+"_x")
				    .attr("x1", x)
				    .attr("y1", -10)
				    .attr("x2", x)
				    .attr("y2", h+10);

			var visYLine = visGrid.selectAll("line."+graphId+"_y").data(y.domain());
			visYLine.enter().append("line")
			visYLine.attr("class", graphId+"_y")
				    .attr("x1", -10)
				    .attr("y1", y)
				    .attr("x2", w+10)
				    .attr("y2", y);

			visGrid.selectAll("line[class^="+graphId+"_]")
					.style("fill", "none")
					.style("stroke-width", strokeWidth)
					.style("stroke", gridLineColor)
					.style("opacity", 0.4)
					.style("shape-rendering", "crispEdges")
					.style("vector-effect", "non-scaling-stroke");
		}
	};
} )();