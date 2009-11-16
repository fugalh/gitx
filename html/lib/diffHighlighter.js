// If we run from a Safari instance, we don't
// have a Controller object. Instead, we fake it by
// using the console
if (typeof Controller == 'undefined') {
    Controller = console;
    Controller.log_ = console.log;
}

var highlightDiff = function(diff, element, callbacks) {
    if (!diff || diff == "")
        return;

    if (!callbacks)
        callbacks = {};
    var start = new Date().getTime();
    element.className = "diff";
    var content = diff.escapeHTML();

    var file_index = 0;

    var startname = "";
    var endname = "";
    var line1 = "";
    var line2 = "";
    var diffContent = "";
    var finalContent = "";
    var lines = content.split('\n');
    var binary = false;
    var mode_change = false;
    var old_mode = "";
    var new_mode = "";

    var hunk_start_line_1 = -1;
    var hunk_start_line_2 = -1;

    var header = false;

    var finishContent = function() {
        finish_adddel();

        if (!file_index) {
            file_index++;
            return;
        }

        if (callbacks["newfile"])
            callbacks["newfile"](startname, endname, "file_index_" +
                                 (file_index - 1), mode_change, old_mode,
                                 new_mode);

        var title = startname;
        var binaryname = endname;
        if (endname == "/dev/null") {
            binaryname = startname;
            title = startname;
        }
        else if (startname == "/dev/null")
            title = endname;
        else if (startname != endname)
            title = startname + " renamed to " + endname;

        if (binary && endname == "/dev/null") {
            // for a deleted binary file, there is no diff/file to display
            line1 = "";
            line2 = "";
            diffContent = "";
            file_index++;
            startname = "";
            endname = "";
            return; // so printing the filename in the file-list is enough
        }

        if (diffContent != "" || binary) {
            finalContent +=
                '<div class="file" id="file_index_' + (file_index - 1) + '">' +
                '<div class="fileHeader">' + title + '</div>';
        }

        if (!binary && (diffContent != ""))  {
            finalContent += '<div class="diffContent">' +
                '<div class="lineno">' + line1 + "</div>" +
                '<div class="lineno">' + line2 + "</div>" +
                '<div class="lines">' + diffContent + "</div>" +
                '</div>';
        }
        else {
            if (binary) {
                if (callbacks["binaryFile"])
                    finalContent += callbacks["binaryFile"](binaryname);
                else
                    finalContent += "<div>Binary file differs</div>";
            }
        }

        if (diffContent != "" || binary)
            finalContent += '</div>';

        line1 = "";
        line2 = "";
        diffContent = "";
        file_index++;
        startname = "";
        endname = "";
    }

    var adds = "";
    var dels = "";
    var finish_adddel = function() {
        if (adds == "" && dels == "")
            return;

        // chomp extra newlines
        nodel = (dels == "");
        noadd = (adds == "");
        dels = dels.replace(/\n$/,'');
        adds = adds.replace(/\n$/,'');
        if (nonl) {
            adds += "↵";
            nonl = false;
        }

        // align them with dynamic programming
        // kinda slow, so if the chunk is too large let's just skip it (or
        // later, we can do some kind of cheaper less-perfect alignment). This
        // number is somewhat arbitrary, more conscientious performance testing
        // in order to find the most reasonable balance is probably in order.
        if (dels.length > 0 && adds.length > 0 &&
            adds.length * dels.length < 100000 ) {

            // dynamic programming
            var scores = new Array(dels.length + 1);
            for (var i=0; i<=dels.length; i++)
                scores[i] = 0;
            var choices = new Array(adds.length);
            for (var j=0; j<adds.length; j++) {
                choices[j] = "";
                prev_scores = [].concat(scores);
                for (var i=0; i<dels.length; i++) {
                    var score = prev_scores[i+1];
                    var choice = 'u';
                    if (score < scores[i]) {
                        choice = 'l';
                        score = scores[i];
                    }
                    if (dels[i] == adds[j] && score <= prev_scores[i] + 1) {
                        choice = 'b';
                        score = prev_scores[i] + 1;
                    }

                    scores[i+1] = score;
                    choices[j] += choice;
                }
            }

            // pain in the neck markup in the aftermath of dynamic programming
            var dels_span_open = false, adds_span_open = false;
            var dels2 = "", adds2 = "";
            var i = dels.length-1, j = adds.length-1;
            while (i >= 0 || j >= 0) {
                if (j >= 0)
                    if (i >= 0)
                        c = choices[j][i];
                    else
                        c = 'u';
                else
                    c = 'l';

                switch (c) {
                    case 'b':
                        if (dels_span_open) {
                            dels2 = '<span class="unique">' + dels2;
                            dels_span_open = false;
                        }
                        dels2 = dels[i--] + dels2;

                        if (adds_span_open) {
                            adds2 = '<span class="unique">' + adds2;
                            adds_span_open = false;
                        }
                        adds2 = adds[j--] + adds2;
                        break;
                    case 'l':
                        if (!dels_span_open) {
                            dels2 = '</span>' + dels2;
                            dels_span_open = true;
                        }
                        dels2 = dels[i--] + dels2;
                        break;
                    case 'u':
                        if (!adds_span_open) {
                            adds2 = '</span>' + adds2;
                            adds_span_open = true;
                        }
                        adds2 = adds[j--] + adds2;
                        break;
                }
            }
            if (dels_span_open) {
                dels2 = '<span class="unique">' + dels2;
                dels_span_open = false;
            }
            if (adds_span_open) {
                adds2 = '<span class="unique">' + adds2;
                adds_span_open = false;
            }

            dels = dels2;
            adds = adds2;
        }

        // add the - and + back in
        if (!nodel) {
            var minus = '<span class="delline">-</span>';
            dels = minus + dels.replace(/\n/g, "\n" + minus);
            diffContent +=
                "<div " + sindex + "class='delline'>" + dels + "</div>";
        }
        if (!noadd) {
            var plus = '<span class="addline">+</span>';
            adds = plus + adds.replace(/\n/g, "\n" + plus);
            diffContent +=
                "<div " + sindex + "class='addline'>" + adds + "</div>";
        }

        dels = "";
        adds = "";
    }

    var nonl = false;
    for (var lineno = 0, lindex = 0; lineno < lines.length; lineno++) {
        var l = lines[lineno];

        if (l.match(/^\\ No newline/)) {
            nonl = true;
            continue;
        }

        // "diff", i.e. new file, we have to reset everything
        if (l.match(/^diff/)) {

            // diff always starts with a header
            header = true;

            finishContent(); // Finish last file

            binary = false;
            mode_change = false;

            // there are cases when we need to capture filenames from the diff
            // line, like with mode-changes.  this can get overwritten later
            // if there is a diff or if the file is binary
            if(match = l.match(/^diff --git (a\/)+(.*) (b\/)+(.*)$/)) {
                startname = match[2];
                endname = match[4];
            }

            continue;
        }

        if (header) {
            if (l.match(/^new file mode .*$/)) {
                startname = "/dev/null";
                continue;
            }
            if (match = l.match(/^new mode (.*)$/)) {
                mode_change = true;
                new_mode = match[1];
                continue;
            }
            if (match = l.match(/^old mode (.*)$/)) {
                mode_change = true;
                old_mode = match[1];
                continue;
            }

            if (l.match(/^deleted file mode .*$/)) {
                endname = "/dev/null";
                continue;
            }
            if (match = l.match(/^--- (a\/)?(.*)$/)) {
                startname = match[2];
                continue;
            }
            if (match = l.match(/^\+\+\+ (b\/)?(.*)$/)) {
                endname = match[2];
                continue;
            }
            // If it is a complete rename, we don't know the name yet
            // We can figure this out from 'rename from.. rename to..'
            if (match = l.match(/^rename (from|to) (.*)$/)) {
                if (match[1] == "from")
                    startname = match[2];
                else
                    endname = match[2];
                continue;
            }
            // We might not have a diff from the binary file if it's new.
            // So, we use a regex to figure that out
            if (match =
                l.match(/^Binary files (a\/)?(.*) and (b\/)?(.*) differ$/)) {
                binary = true;
                startname = match[2];
                endname = match[4];
                continue;
            }

            // Finish the header
            if (l.match(/^@/))
                header = false;
            else
                continue;
        }

        sindex = "index=" + lindex.toString() + " ";
        if (l.match(/^-/)) {
            line1 += ++hunk_start_line_1 + "\n";
            line2 += "\n";
            dels += l.substr(1) + "\n";
        } else if (l.match(/^\+/)) {
            line1 += "\n";
            line2 += ++hunk_start_line_2 + "\n";
            adds += l.substr(1) + "\n";
        } else {
            finish_adddel();
        }

        if (l.match(/^ /)) {
            line1 += ++hunk_start_line_1 + "\n";
            line2 += ++hunk_start_line_2 + "\n";

            diffContent +=
                "<div " + sindex + "class='noopline'>" + l + "</div>";
        } else if (m = l.match(/^@@ \-([0-9]+),?\d* \+(\d+),?\d* @@/)) {
            if (header)
                header = false;

            hunk_start_line_1 = parseInt(m[1]) - 1;
            hunk_start_line_2 = parseInt(m[2]) - 1;
            line1 += "...\n";
            line2 += "...\n";
            diffContent +=
                "<div " + sindex + "class='hunkheader'>" + l + "</div>";
        }
        lindex++;
    }

    finishContent();

    // This takes about 7ms
    element.innerHTML = finalContent;

    // TODO: Replace this with a performance pref call
    Controller.log_("Total time:" + (new Date().getTime() - start));
}
