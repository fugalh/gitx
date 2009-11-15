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
        //alignStrings(dels, adds);
        if (dels != "") {
            dels = "-" + dels.replace(/\n/g, "\n-");
            diffContent +=
                "<div " + sindex + "class='delline'>" + dels + "</div>";
        }

        if (adds != "") {
            adds = "+" + adds.replace(/\n/g, "\n+");
            diffContent +=
                "<div " + sindex + "class='addline'>" + adds + "</div>";
        }

        dels = "";
        adds = "";
    }

    for (var lineno = 0, lindex = 0; lineno < lines.length; lineno++) {
        var l = lines[lineno];

        if (l.match(/^\\ No newline/))
            continue;

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
        if (l.match(/^(\+|-)/)) {
            // Highlight trailing whitespace
            if (m = l.match(/\s+$/))
                l = l.replace(/\s+$/,
                              "<span class='whitespace'>" + m + "</span>");
        }

        if (l.match(/^-/)) {
            line1 += ++hunk_start_line_1 + "\n";
            line2 += "\n";
            if (dels != "")
                dels += "\n";
            dels += l.substr(1);
        } else if (l.match(/^\+/)) {
            line1 += "\n";
            line2 += ++hunk_start_line_2 + "\n";
            if (adds != "")
                adds += "\n";
            adds += l.substr(1);
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
