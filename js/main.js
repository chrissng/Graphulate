var handleFileSelect = function(evt) {
	evt.stopPropagation();
	evt.preventDefault();

	this.classList.remove('dropping');

	var files = evt.dataTransfer.files; // FileList object.
	for (var i = 0, f; f = files[i]; i++) {
		// Only process image files.
		//if (!f.type.match('image.*')) continue;
		console.log("Graphulate dropzone content-type: " + f.type);

		var reader = new FileReader();

		// Closure to capture the file information.
		reader.onload = (function(theFile) {
			return function(e) {
				var data;
				try {
					data = JSON.parse(e.target.result);
				} catch (err) {
					console.log(err);
					alert("a minor data loading hiccup");
					return;
				}
				if (!data) return;
				loadPivotGraph(data, "-1");
				document.title = "Graphulate - " + theFile.name;
				document.getElementById("mPivotGraphTitle").innerHTML = escape(theFile.name);
			};
		})(f);

		reader.readAsText(f); // Read in the image file as a data URL.
	}
}

function handleDragEnter(evt) {
	this.classList.add('dropping'); // this / e.target is the current hover target.
}

function handleDragLeave(evt) {
	this.classList.remove('dropping');  // this / e.target is previous target element.
}

function handleDragOver(evt) {
	evt.stopPropagation();
	evt.preventDefault();
	evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

// Setup the dnd listeners.
var dropZone = document.getElementsByClassName('mPivotGraphDataDropZone')[0];
dropZone.addEventListener('dragover', handleDragOver, false);
dropZone.addEventListener('drop', handleFileSelect, false);
dropZone.addEventListener('dragenter', handleDragEnter, false);
dropZone.addEventListener('dragleave', handleDragLeave, false);


var generateAxisDropDownList = function(data) {
	var axisChange = function() {
		var selX = d3.select("#pivot_x_axis");
		var selXVal = selX.node().options[selX.node().selectedIndex].value;

		var selY = d3.select("#pivot_y_axis");
		var selYVal = selY.node().options[selY.node().selectedIndex].value;

		var selYou = d3.select("#search_yourself");
		var selYouVal = selYou.node().options[selYou.node().selectedIndex].value;

		MPivotGraph.build(MPivotGraph.graphId, selYouVal, data, selXVal, selYVal);
	};

	var tempDataProperty = [];
	for (var i = 0; i < data.nodes.length; i++) {
		tempDataProperty.push.apply(tempDataProperty, Object.keys(data.nodes[i]));
	}
	var onlyUnique = function(value, index, self) {
		return self.indexOf(value) === index && value != "index" && value != "order" && value != "oid";
	};
	var dataProperty = tempDataProperty.filter(onlyUnique);
		dataProperty.sort();
	MPivotGraph.dataProperty = dataProperty;

	var selectXAxis = d3.select("#pivot_x_axis");
		selectXAxis.on("change", axisChange);
	var optionXAxis = selectXAxis.selectAll("option").data(dataProperty);
		optionXAxis.enter().append("option")
				.attr("selected", function(d) {
					if (d == "name") {
						return "";
					}
				});
		optionXAxis
				.attr("value", String)
				.text(String);
		optionXAxis.exit().remove();

	var selectYAxis = d3.select("#pivot_y_axis");
		selectYAxis.on("change", axisChange);
	var optionYAxis = selectYAxis.selectAll("option").data(dataProperty);
		optionYAxis.enter().append("option")
				.attr("selected", function(d) {
					if (d == "generation") {
						return "";
					}
				});
		optionYAxis
				.attr("value", String)
				.text(String);
		optionYAxis.exit().remove();


	var nameListRaw = [];
	for (var i = 0; i < data.nodes.length; i++) {
		var name = data.nodes[i].name;
		if (name) nameListRaw.push([data.nodes[i].oid, (name.length > 17 ? (name.substr(0, 17) + "...") : name)]);
	}
	nameListRaw.sort(function(a,b) {
		if (!a[1]) return true;
		return a[1].localeCompare(b[1])
	});
	nameListRaw.unshift([-1, ". . ."]);

	var searchYourself = d3.select("#search_yourself");
		searchYourself.on("change", axisChange);
	var searchYourselfOption = searchYourself.selectAll("option").data(nameListRaw, function(d) { return d[0]; } );
		searchYourselfOption.enter().append("option")
				.attr("selected", function(d) {
					if (d == ". . .") {
						return "";
					}
				});
		searchYourselfOption
				.attr("value", function(d) { return d[0]; })
				.text(function(d) { return d[1]; });
		searchYourselfOption.exit().remove();


	var nodeSizer = d3.select("#size_node");
		nodeSizer.on("change", function(d) {  MPivotGraph.resizeNode(MPivotGraph.graphId, d3.select(this).node().value); });
		if (!(nodeSizer.node().value)) {
			nodeSizer.attr("value", 40);
		}
}

var loadPivotGraph = function(data, oid) {
	if (!data || data == null) {
		/*
		tempDiv.interrupt().transition().each("end", function() {
			tempDiv.text("no results found.");
		});
		*/
		alert("a minor data loading hiccup");
		return;
	}

	//tempDiv.text("rendering...");

	MPivotGraph.rawData = data;
	console.log("PivotGraph - nodes: " + data.nodes.length + ", links: " + data.links.length);


	// Event entities do not use names, but sub types else there's it is too cluttered.
	/*
	for (i = 0; i < data.nodes.length; i++) {
		if (data.nodes[i].type.toUpperCase() != "EVENT") continue;

		// node index 0 is always our target entity!
		if ((i > 0) || (i == 0 && (data.nodes[i].name == undefined || data.nodes[i].name.trim() == ""))) {
			// All other entities use subtype to reduce clutter
			// Target entity uses name, but if there's no name, use subType
			data.nodes[i].name = data.nodes[i].subType;
		}
	}*/


	generateAxisDropDownList(MPivotGraph.rawData);

	var selX = d3.select("#pivot_x_axis");
	var selXVal = selX.node().options[selX.node().selectedIndex].value;
	var selY = d3.select("#pivot_y_axis");
	var selYVal = selY.node().options[selY.node().selectedIndex].value;
	var selYou = d3.select("#search_yourself");
	var selYouVal = selYou.node().options[selYou.node().selectedIndex].value;

	d3.select("div#pgControls").transition(1000).style("opacity", 1.0);

	MPivotGraph.build(MPivotGraph.graphId, selYouVal, MPivotGraph.rawData, selXVal, selYVal);
};

var initPivotGraph = function(divId, graphId, oid) {
	if (!oid) return;

	MPivotGraph.divId = divId;
	MPivotGraph.graphId = graphId;

	/*
	var pgSvg = d3.selectAll("svg#"+MPivotGraph.graphId+" *").remove();

	d3.select("div#mPivotGraphDIV div#mPivotGraphDIV_prompt").remove();
	var tempDiv = d3.select("div#mPivotGraphDIV").data([{maxI:3}]).append("div")
		.attr("id", "mPivotGraphDIV_prompt")
		.style("position", "absolute")
		.style("width", "100%")//.style("width", "200px")
		.style("height", "100%")//.style("height", "50px")
		.style("left", "0%")//.style("left", "50%")
		.style("top", "50%")
		.style("overflow", "hidden")
		.style("font-size", "16px")
		.style("text-align", "center");

	var loadingPrompt = function(dataOrig) {
		tempDiv.transition().duration(200)
			.text(function(d) {
				if (d.i == undefined) {
					d.dataOrig = dataOrig;
					d.i = 0;
					d.data = d.dataOrig;
				}
				if (d.i < d.maxI) {
					d.data = "\u00A0" + d.data + ".";
					d.i++;
					return d.data;
				} else {
					d.i = 0;
					d.data = d.dataOrig;
					d.dataOrig = dataOrig;
					return d.data;
				}
			})
			.each("end", function() {
				loadingPrompt(dataOrig);
			});
	}; loadingPrompt("fetching");

	var getEventsOidJSON = function(nodeData) {
		var oidList = [];
		for (var i = 0; i < nodeData.length; i++) {
			if (nodeData[i].type && nodeData[i].type.trim().toUpperCase() == "EVENT")
				oidList.push(nodeData[i].oid.trim());
		}

		return {
			"oidList": oidList
		};
	};

	loadSample(oid);

	*/
};

var loadSample = function(oid) {
	if (MPivotGraph.mPivotGraphXHR) MPivotGraph.mPivotGraphXHR.abort();

	var start = 0;
	var end = 6;
	var iId = setInterval(function() {
		MPivotGraph.mPivotGraphXHR = d3.json("family_tree_"+start+".json")
		.on("error", function(error) {
			//tempDiv.interrupt().transition().each("end", function() {
			//	tempDiv.text("no results found");
			//});

			alert("a minor data loading hiccup");
		})
		.on("load", function(d) {
			loadPivotGraph(d, (!oid) ? "-1": oid);
			start++;

			if (start > end) 	{
				clearInterval(iId);
			}
		})
		.get();
	}, 2000);
}

var reversePivotGraphAxle = function() {
	var selX = d3.select("#pivot_x_axis");
	var selXVal = selX.node().options[selX.node().selectedIndex].value;

	var selY = d3.select("#pivot_y_axis");
	var selYVal = selY.node().options[selY.node().selectedIndex].value;

	MPivotGraph.reverseAxis();
	MPivotGraph.build(MPivotGraph.graphId, null, MPivotGraph.rawData, selXVal, selYVal);
};
