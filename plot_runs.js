/**
 * plot_runs.js
 *
 * Copyright 2014 Robert Moss.
 *
 * This work is distributed under the terms of the BSD 2-Clause License
 * (http://opensource.org/licenses/BSD-2-Clause).
 */

// Create a new namespace to contain all of the variables and functions.
var Plot = Plot || {};

// Calculate various metrics from the raw data.
Plot.prepare_data = function(data_rows) {
    var date_format = d3.time.format("%Y-%m-%d");
    var time_format = d3.time.format("%H:%M:%S");

    data_rows.forEach(function(d) {
        d.date = date_format.parse(d.date);
        d.distance = +d.distance;
        d.time = time_format.parse(d.time);
        d.time = d.time.getSeconds() + 60 * d.time.getMinutes() +
            60 * 60 * d.time.getHours();
        d.time_mins = d.time / 60;
        d.time_secs = Math.round(d.time - 60 * d.time_mins);
        d.speed_mins = Math.floor(d.time / d.distance / 60);
        d.speed_secs = Math.round(d.time / d.distance - 60 * d.speed_mins);
        d.speed = d.speed_secs + 60 * d.speed_mins;
    });

    return data_rows;
}

// A standard linear numerical axis, with adjustable precision.
Plot.num_axis = function(label, precision, get) {
    return {
        get: get,
        scale: d3.scale.linear(),
        tick: 5,
        grid: 10,
        fmt_tick: function(d) { return d.toFixed(precision); },
        label: label
    };
}

// A date axis.
Plot.date_axis = function(label, get) {
    return {
        get: get,
        scale: d3.time.scale(),
        tick: 5,
        grid: 10,
        fmt_tick: d3.time.format("%Y-%m-%d"),
        label: label
    };
}

// A time axis, where the underlying data is in seconds and is displayed as
// MM:SS. Note that hours are not accounted for, the minutes simply increase.
Plot.time_axis = function(label, get) {
    return {
        get: get,
        scale: d3.scale.linear(),
        tick: 5,
        grid: 10,
        fmt_tick: function(secs) {
            var mins = Math.floor(secs / 60);
            secs = Math.round(secs - 60 * mins);
            if (secs < 10) {
                return mins + ":0" + secs;
            } else {
                return mins + ":" + secs;
            }
        },
        label: label
    };
}


// Draw a single plot.
Plot.draw = function(prep_data, plot) {
    plot.net_w = parseFloat(plot.dims.w) + parseFloat(plot.dims.margin_x),
    plot.net_h = parseFloat(plot.dims.h) + parseFloat(plot.dims.margin_y)

    // Create the SVG element that will contain the plot.
    plot.svg_elt = d3.select(plot.selector)
        .append("svg:svg")
        .attr("width", plot.net_w)
        .attr("height", plot.net_h)
        .attr("preserveAspectRatio", "none");

    // Create the group element that will contain every plot component.
    plot.contents = plot.svg_elt.append("svg:g")
        .attr("transform",
              "translate(" + plot.dims.margin_x + ", 0)");

    // Perform any plot-specific data manipulation.
    if (plot.hasOwnProperty('get_plot_data')) {
        plot.data = plot.get_plot_data(prep_data);
    } else {
        plot.data = prep_data;
    }

    // Calculate the plot axis domains.
    plot.axis = {
        x_dom: d3.extent(plot.data, plot.x.get),
        y_dom: d3.extent(plot.data, plot.y.get)
    };

    // Account for error bars, if any.
    if (plot.hasOwnProperty('ymin') && plot.hasOwnProperty('ymax')) {
        plot.axis.y_dom[0] = Math.min(plot.axis.y_dom[0],
                                      d3.min(plot.data, plot.ymin));
        plot.axis.y_dom[1] = Math.max(plot.axis.y_dom[1],
                                      d3.max(plot.data, plot.ymax));
    }

    // Pad the axis domains so that points don't sit on the edges of the plot.
    // The Number() function is used so that the padding works for numeric
    // and date scales.
    var x_range = Number(plot.axis.x_dom[1]) - Number(plot.axis.x_dom[0]),
        y_range = plot.axis.y_dom[1] - plot.axis.y_dom[0];
    plot.axis.x_dom[0] = Number(plot.axis.x_dom[0]) - 0.025 * x_range;
    plot.axis.x_dom[1] = Number(plot.axis.x_dom[1]) + 0.025 * x_range;
    plot.axis.y_dom[0] = plot.axis.y_dom[0] - 0.025 * y_range;
    plot.axis.y_dom[1] = plot.axis.y_dom[1] + 0.025 * y_range;

    // Create the axis scales.
    plot.axis.x = plot.x.scale.domain(plot.axis.x_dom)
        .range([0, plot.dims.w - plot.dims.padding]);
    plot.axis.y = plot.y.scale.domain(plot.axis.y_dom)
        .range([plot.dims.h, 0]);

    // How to draw a line.
    plot.draw_line = d3.svg.line()
        .x(function(d) { return plot.axis.x(plot.x.get(d)); })
        .y(function(d) { return plot.axis.y(plot.y.get(d)); });

    // Draw the x-axis.
    plot.contents.append("svg:line")
        .attr("x1", plot.axis.x(plot.axis.x_dom[0]))
        .attr("y1", plot.axis.y(plot.axis.y_dom[0]))
        .attr("x2", plot.axis.x(plot.axis.x_dom[1]))
        .attr("y2", plot.axis.y(plot.axis.y_dom[0]));

    // Draw the y-axis.
    plot.contents.append("svg:line")
        .attr("x1", plot.axis.x(plot.axis.x_dom[0]))
        .attr("y1", plot.axis.y(plot.axis.y_dom[0]))
        .attr("x2", plot.axis.x(plot.axis.x_dom[0]))
        .attr("y2", plot.axis.y(plot.axis.y_dom[1]));

    // Draw the x-axis label.
    plot.contents.append("text")
        .attr("class", "xTitle")
        .attr("x", plot.dims.w / 2)
        .attr("y", plot.dims.margin_y + plot.axis.y(plot.axis.y_dom[0]))
        .attr("dy", "-0.4em")
        .style("text-anchor", "middle")
        .text(plot.x.label);

    // Draw the y-axis label.
    plot.contents.append("text")
        .attr("class", "yTitle")
        .attr("y", - 0.6 * plot.dims.margin_x)
        .attr("x", - plot.dims.h / 2)
        .attr("dy", "-0.8em")
        .style("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .text(plot.y.label);

    // Draw the x-axis tick labels.
    plot.contents.selectAll(".xLabel")
        .data(plot.axis.x.ticks(plot.x.tick))
        .enter().append("svg:text")
        .attr("class", "xLabel")
        .text(plot.x.fmt_tick)
        .attr("x", function(d) { return plot.axis.x(d) })
        .attr("y", 0.5 * plot.dims.margin_y + plot.axis.y(plot.axis.y_dom[0]))
        .attr("text-anchor", "middle");

    // Draw the y-axis tick labels.
    plot.contents.selectAll(".yLabel")
        .data(plot.axis.y.ticks(plot.y.tick))
        .enter().append("svg:text")
        .attr("class", "yLabel")
        .text(plot.y.fmt_tick)
        .attr("x", - 0.25 * plot.dims.margin_x)
        .attr("y", function(d) { return plot.axis.y(d) })
        .attr("text-anchor", "end")
        .attr("dy", 4);

    // Draw the x-axis tick lines.
    plot.contents.selectAll(".xTicks")
        .data(plot.axis.x.ticks(plot.x.tick))
        .enter().append("svg:line")
        .attr("class", "xTicks")
        .attr("x1", function(d) { return plot.axis.x(d); })
        .attr("y1", plot.axis.y(plot.axis.y_dom[0]))
        .attr("x2", function(d) { return plot.axis.x(d); })
        /* Scale the size of the ticks relative to the y domain. */
        .attr("y2", plot.axis.y(plot.axis.y_dom[0]) + 0.2 * plot.dims.margin_y);

    // Draw the y-axis tick lines.
    plot.contents.selectAll(".yTicks")
        .data(plot.axis.y.ticks(plot.y.tick))
        .enter().append("svg:line")
        .attr("class", "yTicks")
        .attr("y1", function(d) { return plot.axis.y(d); })
        .attr("x1", - 0.125 * plot.dims.margin_x)
        .attr("y2", function(d) { return plot.axis.y(d); })
        .attr("x2", 0);

    // Plot the vertical grid lines.
    plot.contents.selectAll(".xGrid")
        .data(plot.axis.x.ticks(plot.x.grid))
        .enter().append("svg:line")
        .attr("class", "grid")
        .attr("x1", function(d) { return plot.axis.x(d); })
        .attr("y1",  plot.axis.y(plot.axis.y_dom[0]))
        .attr("x2", function(d) { return plot.axis.x(d); })
        /* Scale the size of the ticks relative to the y domain. */
        .attr("y2", plot.axis.y(plot.axis.y_dom[1]));

    // Plot the horizontal grid lines.
    plot.contents.selectAll(".yGrid")
        .data(plot.axis.y.ticks(plot.y.grid))
        .enter().append("svg:line")
        .attr("class", "grid")
        .attr("y1", function(d) { return plot.axis.y(d); })
        .attr("x1", plot.axis.x(plot.axis.x_dom[0]))
        .attr("y2", function(d) { return plot.axis.y(d); })
        /* Scale the size of the ticks relative to the y domain. */
        .attr("x2", plot.axis.x(plot.axis.x_dom[1]));

    // Draw a line for each data series.
    if (plot.hasOwnProperty('group')) {
        // Multiple data series.
        var data_series = d3.nest()
            .key(plot.group)
            .entries(plot_data);
        for (var i = 0; i < data_series.length; i++) {
            plot.contents.append("svg:path")
                .data([data_series[i].values])
                .attr("class", data_series[i].key + " series")
                .attr("d", plot.draw_line)
        }
    } else {
        // A single data series.
        plot.contents.append("svg:path")
            .data([plot.data])
            .attr("class", "series")
            .attr("d", plot.draw_line)
    }

    // Draw the error bars, if any.
    if (plot.hasOwnProperty('ymin') && plot.hasOwnProperty('ymax')) {
        plot.data.forEach(function(d) {
            var x = plot.axis.x(plot.x.get(d));
            var y1 = plot.axis.y(plot.ymin(d));
            var y2 = plot.axis.y(plot.ymax(d));
            var classes = "errorbar";
            if (plot.hasOwnProperty('group')) {
                classes = classes + " " + plot.group(d);
            }

            plot.contents.append("svg:line")
                .attr("class", classes)
                .attr("x1", x)
                .attr("x2", x)
                .attr("y1", y1)
                .attr("y2", y2);
            plot.contents.append("svg:line")
                .attr("class", classes)
                .attr("x1", x - 5)
                .attr("x2", x + 5)
                .attr("y1", y1)
                .attr("y2", y1);
            plot.contents.append("svg:line")
                .attr("class", classes)
                .attr("x1", x - 5)
                .attr("x2", x + 5)
                .attr("y1", y2)
                .attr("y2", y2);
        })
    };

    // Draw points along the line.
    plot.data.forEach(function(d) {
        var classes = "point";
        if (plot.hasOwnProperty('group')) {
            classes = classes + " " + plot.group(d);
        }
        plot.contents.append("svg:circle")
            .attr("class", classes)
            .attr("cx", plot.axis.x(plot.x.get(d)))
            .attr("cy", plot.axis.y(plot.y.get(d)))
            .attr("r", 5)
    });
}

Plot.draw_many = function(data_file, prepare_data, plots) {
    // Asynchronously load the data file and prepare it for the plots,
    // then draw each plot in turn.
    d3.csv(
        data_file,
        function(error, data_rows) {
            if (error == null) {
                plot_data = prepare_data(data_rows);
                for (var i = 0; i < plots.length; i++) {
                    Plot.draw(plot_data, plots[i]);
                }
            } else {
                console.log(error);
            }
        });
}

var width = document.getElementById('content').offsetWidth * 0.6;
var height = 0.75 * width;
var dims = { w: width - 75, h: height - 50,
             margin_x: 75, margin_y: 50,
             padding: 10 };

var p_dist = {
    dims: dims,
    selector: "#run",
    get_plot_data: function(data_rows) {
        return data_rows.filter(function (d) { return d.end === "yes"; });
    },
    x: Plot.date_axis("Date", function(d) { return d.date; }),
    y: Plot.num_axis("Distance (km)", 0,
                     function(d) { return d.distance; }),
}, p_speed = {
    dims: dims,
    selector: "#speed",
    get_plot_data: function(data_rows) {
        return data_rows.filter(function (d) { return d.end === "yes"; });
    },
    x: Plot.date_axis("Date", function(d) { return d.date; }),
    y: Plot.time_axis("Average Speed (min/km)",
                      function(d) { return d.speed; }),
}, p_best_time = {
    dims: dims,
    selector: "#best-time",
    get_plot_data: function(data_rows) {
        var best_rows = d3.nest()
            .key(function(d) { return d.distance; })
            .sortKeys(function (a,b) {
                return (+b) < (+a) ? 1 : (+b) > (+a) ? -1 : 0; })
            .entries(data_rows);
        for (var i = 0; i < best_rows.length; i++) {
            best_rows[i].best_time = Math.min.apply(
                null, best_rows[i].values.map(
                    function (d) { return d.time_mins; }));
            best_rows[i].key = parseFloat(best_rows[i].key);
        }
        return best_rows;
    },
    x: Plot.num_axis("Distance (km)", 0, function(d) { return d.key; }),
    y: Plot.num_axis("Time (min)", 0, function(d) { return d.best_time; }),
}, p_best_speed = {
    dims: dims,
    selector: "#best-speed",
    get_plot_data: function(data_rows) {
        var best_rows = d3.nest()
            .key(function(d) { return d.distance; })
            .sortKeys(function (a,b) {
                return (+b) < (+a) ? 1 : (+b) > (+a) ? -1 : 0; })
            .entries(data_rows);
        for (var i = 0; i < best_rows.length; i++) {
            best_rows[i].best_speed = Math.min.apply(
                null, best_rows[i].values.map(
                    function (d) { return d.speed; }));
            best_rows[i].key = parseFloat(best_rows[i].key);
        }
        return best_rows;
    },
    x: Plot.num_axis("Distance (km)", 0, function(d) { return d.key; }),
    y: Plot.time_axis("Average Speed (min/km)",
                      function(d) { return d.best_speed; }),
}

// Draw the plots.
Plot.draw_many("data/runs.csv", Plot.prepare_data,
               [p_dist, p_speed, p_best_time, p_best_speed]);

// Hide the warning about javascript being disabled.
d3.selectAll(".hidejs").style("display", "none")

// Show the javascript-generated content.
d3.selectAll(".showjs").style("display", "block")
