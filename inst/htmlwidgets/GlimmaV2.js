HTMLWidgets.widget({

  name: 'GlimmaV2',

  type: 'output',

  factory: function(el, width, height) {

    // TODO: define shared variables for this instance
 
    return {

      renderValue: function(x) {

        console.log(x);
        processData(x);

        var plotContainer = document.createElement("div");
        var mdsContainer = document.createElement("div");
        var eigenContainer = document.createElement("div");
        var controlContainer = document.createElement("div");
        mdsContainer.setAttribute("id", "mdsContainer");
        eigenContainer.setAttribute("id", "eigenContainer");
        plotContainer.setAttribute("id", "plotContainer");
        controlContainer.setAttribute("id", "controlContainer");

        var widget = document.getElementById(el.id);
        widget.appendChild(plotContainer);
        widget.appendChild(controlContainer);

        plotContainer.appendChild(mdsContainer);
        plotContainer.appendChild(eigenContainer);

        mdsData = HTMLWidgets.dataframeToD3(x.data.mdsData);
        eigenData = HTMLWidgets.dataframeToD3(x.data.eigenData);

        // TODO: extract this data from dataframe
        var dimList = ["dim1", "dim2", "dim3", "dim4", "dim5", "dim6"];

        var mdsSpec = createMDSSpec(mdsData, dimList, 
                                      x.data.features,
                                      width, height);

        
        // create tooltip handler
        var handler = new vegaTooltip.Handler();

        mdsView = new vega.View(vega.parse(mdsSpec), {
          renderer: 'canvas',
          container: '#' + mdsContainer.getAttribute("id"),
          bind: '#' + controlContainer.getAttribute("id"),
          hover: true
        });
        mdsView.tooltip(handler.call);
        mdsView.runAsync();

        var eigenSpec = createEigenSpec(eigenData, width, height);
        eigenView = new vega.View(vega.parse(eigenSpec), {
          renderer: 'canvas',
          container: '#' + eigenContainer.getAttribute("id"),
          hover: true
        });
        eigenView.runAsync();



        linkPlots();
        addControls(controlContainer);
        reformatElements();

      },

      resize: function(width, height) 
      {
        console.log("resize called, width=" + width + ",height=" + height);
        if (mdsView)
        {
          console.log("mdsView width=" + mdsView.width() + ",height=" + mdsView.height());
          mdsView.resize();
          console.log("mdsView after resize width=" + mdsView.width() + ",height=" + mdsView.height());
        }
        if (eigenView)
        {
          eigenView.resize();
        }
      }

    };
  }
});

function processData(x)
{
  /* if there's only a single feature in an R vector,
    it does not become an array after data transformation to JS */
  if (!Array.isArray(x.data.features["numeric"]))
  {
    x.data.features["numeric"] = [ x.data.features["numeric"] ];
  }
  if (!Array.isArray(x.data.features["discrete"]))
  {
    x.data.features["discrete"] = [ x.data.features["discrete"] ];
  }
  x.data.features["numeric"].sort();
  x.data.features["discrete"].sort();
}

function linkPlots()
{
  
  // highlight variance plot when we change a signal in the MDS plot
  mdsView.addSignalListener('x_axis', function(name, value) {
    var externalSelectValue = parseInt(value.substring(3));
    eigenView.signal("external_select_x", externalSelectValue);
    eigenView.runAsync();
  });

  mdsView.addSignalListener('y_axis', function(name, value) {
    var externalSelectValue = parseInt(value.substring(3));
    eigenView.signal("external_select_y", externalSelectValue);
    eigenView.runAsync();
  });

}

function addControls(controlContainer)
{

  // save to PNG button for MDS plot
  var downloadButton = document.createElement("BUTTON");
  downloadButton.setAttribute("id", "savePNGBtn");
  downloadButton.innerHTML = "Save to PNG";
  downloadButton.onclick =
  function changeContent() {
    mdsView.toImageURL('png').then(function (url) {
      var link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('target', '_blank');
      link.setAttribute('download', 'vega-export.png');
      link.dispatchEvent(new MouseEvent('click'));
    }).catch(function (error) { /* error handling */ });
  }
  controlContainer.appendChild(downloadButton);

}

function reformatElements(controlContainer)
{
  binds = document.getElementsByClassName("vega-bind");
  for (var i = 0; i < binds.length; i++)
  {
    if (i == 2)
    {
      binds[i].className += " separator_signal";
    }
    else if (i > 2)
    {
      binds[i].className += " signal";
    }
  }
}

// parametrise graph encoding for MDS plot
function createMDSSpec(mdsData, dimList, features, width, height) 
{
  console.log(features);

  // generate tooltip object for embedding in spec
  var tooltipString = "{'x':datum[x_axis], 'y':datum[y_axis]";
  features["all"].forEach(function(x) 
  {
    if (x != "-" && x != "- ")
    {
      tooltipString += `,'${x}':datum['${x}']`;
    }  
  });
  tooltipString += "}";
  console.log(tooltipString)
  var tooltip = { "signal" : tooltipString };
  
  return {
    "$schema": "https://vega.github.io/schema/vega/v5.json",
    "description": "Testing ground for GlimmaV2",
    "width": width * 0.45,
    "height": height * 0.6,
    "padding": 0,
    "title": {
      "text": "MDS Plot"
    },
    "signals":
      [
        {
          "name": "x_axis",
          "value": dimList[0],
          "bind": { "input": "select", "options": dimList }
        },
        {
          "name": "y_axis",
          "value": dimList[1],
          "bind": { "input": "select", "options": dimList }
        },
        /* dummy_signal is used for CSS styling */
        {
          "name": "dummy_signal",
          "value": {},
          "bind": { "input": "select", "options": [] }
        },
        {
          "name": "scale_by",
          "value": features["numeric"][0],
          "bind": { "input": "select", "options": features["numeric"] }
        },
        {
          "name": "colour_by",
          "value": features["discrete"][0],
          "bind": { "input": "select", "options": features["discrete"] }
        },
        {
          "name": "shape_by",
          "value": features["discrete"][0],
          "bind": { "input": "select", "options": features["discrete"] }
        }
      ],
    "data": 
      [
        {
          "name": "source",
          "values": mdsData,
          "transform": [{
            "type": "formula",
            "expr": "datum.x",
            "as": "tooltip"
          }]
        }
      ],
    "scales": [
      {
        "name": "x",
        "type": "linear",
        "round": true,
        "nice": true,
        "zero": true,
        "domain": { "data": "source", "field": { "signal": "x_axis" } },
        "range": "width"
      },
      {
        "name": "y",
        "type": "linear",
        "round": true,
        "nice": true,
        "zero": true,
        "domain": { "data": "source", "field": { "signal": "y_axis" } },
        "range": "height"
      },
      {
        "name": "size",
        "type": "linear",
        "round": true,
        "nice": false,
        "zero": true,
        "domain": { "data": "source", "field": { "signal": "scale_by" } },
        "range": [5, 350]
      },
      {
        "name": "color",
        "type": "ordinal",
        "domain": { "data": "source", "field": { "signal": "colour_by" } },
        "range": { "scheme": "tableau10" }
      },
      {
        "name": "shape",
        "type": "ordinal",
        "domain": { "data": "source", "field": { "signal": "shape_by" } },
        "range": ["circle","square","diamond","triangle", "triangle-up", "cross"]
      }
    ],

    "axes": [
      {
        "scale": "x",
        "grid": true,
        "domain": false,
        "orient": "bottom",
        "tickCount": 5,
        "title": { "signal": "x_axis" }
      },
      {
        "scale": "y",
        "grid": true,
        "domain": false,
        "orient": "left",
        "titlePadding": 5,
        "title": { "signal": "y_axis" }
      }
    ],

    "legends": [
      {
        "size": "size",
        "title": "Scale",
        "format": "s",
        "symbolStrokeColor": "#4682b4",
        "symbolStrokeWidth": 2,
        "symbolOpacity": 0.7,
        "symbolType": "circle"
      },
      {
        "fill": "color",
        "title": "Colour",
        "symbolStrokeColor": "#4682b4",
        "symbolStrokeWidth": 2,
        "symbolOpacity": 0.7,
        "symbolType": "circle"
      },
      {
        "shape": "shape",
        "title": "Shape",
        "symbolStrokeColor": "#4682b4",
        "symbolStrokeWidth": 2,
        "symbolOpacity": 0.7,
      },
    ],

    "marks": [
      {
        "name": "marks",
        "type": "symbol",
        "from": { "data": "source" },
        "encode": {
          "update": {
            "x": { "scale": "x", "field": { "signal": "x_axis" } },
            "y": { "scale": "y", "field": { "signal": "y_axis" } },
            "size": { "scale": "size", "field": { "signal": "scale_by" }},
            "shape": { "scale": "shape", "field": { "signal": "shape_by" } },
            "fill": { "scale": "color", "field": { "signal": "colour_by" } },
            "strokeWidth": { "value": 2 },
            "opacity": { "value": 0.7 },
            "stroke": { "value": "#4682b4" },
            "tooltip": tooltip
          }
        }
      }
    ]
  };
}

// parametrise graph encoding for variance plot
function createEigenSpec(eigenData, width, height) 
{
  return {
    "$schema": "https://vega.github.io/schema/vega/v5.json",
    "description": "A basic bar chart example, with value labels shown upon mouse hover.",
    "width": width * 0.3,
    "height": height * 0.6,
    "padding": 5,
    "title": {
      "text": "Variance Explained"
    },
    "data": [
      {
        "name": "table",
        "values": eigenData
      }
    ],
  
    "signals": [
      {
        "name": "tooltip",
        "value": {},
        "on": 
        [
          {"events": "rect:mouseover", "update": "datum"},
          {"events": "rect:mouseout",  "update": "{}"}
        ]
      },
      {
        "name": "external_select_x",
        "value": 1
      },
      {
        "name": "external_select_y",
        "value": 2
      }
    ],
  
    "scales": [
      {
        "name": "xscale",
        "type": "band",
        "domain": {"data": "table", "field": "name"},
        "range": "width",
        "padding": 0.05,
        "round": true
      },
      {
        "name": "yscale",
        "domain": {"data": "table", "field": "eigen"},
        "range": "height"
      }
    ],
  
    "axes": [
      { "orient": "bottom", "scale": "xscale" },
      { "orient": "left", "scale": "yscale" }
    ],
  
    "marks": [
      {
        "type": "rect",
        "from": {"data":"table"},
        "encode": {
          "enter": {
            "x": {"scale": "xscale", "field": "name"},
            "width": {"scale": "xscale", "band": 1},
            "y": {"scale": "yscale", "field": "eigen"},
            "y2": {"scale": "yscale", "value": 0}
          },
          "update": {
            "fill": [ {"test": "datum.name == external_select_x || datum.name == external_select_y", "value": "sandybrown"}, {"value": "steelblue"} ]
          }
        }
      },
      {
        "type": "text",
        "from": {"data":"table"},
        "encode": {
          "enter": {
            "align": {"value": "center"},
            "baseline": {"value": "bottom"},
            "fill": {"value": "#333"}
          },
          "update": {
            "x": {"scale": "xscale", "field": "name", "band": 0.5},
            "y": {"scale": "yscale", "field": "eigen", "offset": -2},
            "text": {"field": "eigen"},
            "fillOpacity": [
              {"test": "datum.name == external_select_x || datum.name == external_select_y", "value": 1},
              {"value": 0}
            ]
          }
        }
      }
    ]
  };
}