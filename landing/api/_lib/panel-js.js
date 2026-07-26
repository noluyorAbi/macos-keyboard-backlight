/**
 * The launch board, in the browser.
 *
 * A port of the skill's React panel to plain DOM, because this site has no
 * framework and no bundler and is not going to grow one for an admin page. The
 * behaviour is the same: one operator, one browser, no collaboration, which is
 * what lets the whole board be a single state object saved whole on a debounce
 * rather than a set of endpoints per field.
 *
 * Saving is automatic because the failure mode of a manual save button here is
 * losing an evening of post copy, and the failure mode of an automatic one is
 * an extra write.
 *
 * One rule holds the DOM approach together: typing never re-renders. Text
 * inputs mutate the state object in place and schedule a save; only structural
 * changes (add, delete, tab, filter, expand, status) rebuild the view. A full
 * re-render per keystroke would take the caret with it.
 *
 * Kept as a string rather than a served file so the panel has no separately
 * fetchable asset: with ADMIN_PASSWORD unset the whole thing, markup, styles
 * and script, is a 404 rather than a page that is missing its script.
 */

export const PANEL_JS = String.raw`
(function () {
  "use strict";

  var STATUSES = ["todo", "ready", "scheduled", "posted", "skipped"];
  var WAVES = [1, 2, 3, 4];
  var TABS = ["channels", "tasks", "metrics", "data"];

  var boot = document.getElementById("lp-initial");
  var state = JSON.parse(boot.textContent);
  var backend = boot.dataset.backend;

  var tab = "channels";
  var waveFilter = "all";
  var openChannel = null;
  var importDraft = "";
  var importError = "";
  var saveState = "idle";
  var saveTimer = null;

  var root = document.getElementById("lp-app");

  /* ------------------------------------------------------------ saving */

  function scheduleSave() {
    saveState = "saving";
    paintStatus();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      fetch("/api/admin/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
      })
        .then(function (response) {
          saveState = response.ok ? "saved" : "error";
          paintStatus();
        })
        .catch(function () {
          saveState = "error";
          paintStatus();
        });
    }, 700);
  }

  /** A structural change: mutate, save, rebuild. */
  function edit(fn) {
    fn();
    scheduleSave();
    render();
  }

  /** A keystroke: mutate and save, but leave the DOM alone so the caret stays. */
  function quietEdit(fn) {
    fn();
    scheduleSave();
  }

  /* ------------------------------------------------------------- atoms */

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        if (key === "class") node.className = props[key];
        else if (key === "text") node.textContent = props[key];
        else if (key === "style") node.setAttribute("style", props[key]);
        else if (key.slice(0, 2) === "on") node[key.toLowerCase()] = props[key];
        else if (props[key] !== undefined && props[key] !== null) node.setAttribute(key, props[key]);
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function button(label, className, onClick) {
    return el("button", { type: "button", class: className, text: label, onClick: onClick });
  }

  /** Copies its payload and says so for a moment. The word change is the whole feedback. */
  function copyButton(getValue, label) {
    var node = button(label || "copy", "lp-btn is-bare", function () {
      var value = getValue();
      if (!value) return;
      navigator.clipboard.writeText(value).then(function () {
        node.textContent = "copied";
        node.style.color = "var(--lp-accent)";
        setTimeout(function () {
          node.textContent = label || "copy";
          node.style.color = "";
        }, 1400);
      }, function () {
        // A denied clipboard permission is not worth an error state; the text
        // is selectable and the user will see nothing happened.
      });
    });
    return node;
  }

  function labelSpan(text) {
    return el("span", { class: "lp-label", text: text });
  }

  function textField(label, value, onChange, options) {
    var opts = options || {};
    var input = el("input", { class: "lp-input", value: value || "", placeholder: opts.placeholder || "" });
    input.oninput = function () {
      quietEdit(function () {
        onChange(input.value);
      });
    };
    var head = el("span", { class: "lp-field-head" }, [
      labelSpan(label),
      opts.copy
        ? copyButton(function () {
            return input.value;
          })
        : null,
    ]);
    return el("label", { class: "lp-field" }, [head, input]);
  }

  /**
   * Grows with its content up to a ceiling. A post body is between three lines
   * and forty, and a fixed box either wastes the screen or hides the end of the
   * text you are about to paste into a thread you cannot edit afterwards.
   */
  function areaField(label, value, onChange, rows, placeholder) {
    var area = el("textarea", {
      class: "lp-area",
      rows: String(rows || 4),
      placeholder: placeholder || "",
    });
    area.value = value || "";

    var count = el("span", { class: "lp-meta lp-num", text: area.value ? String(area.value.length) : "" });

    function grow() {
      area.style.height = "auto";
      area.style.height = Math.min(area.scrollHeight, 640) + "px";
    }

    area.oninput = function () {
      count.textContent = area.value ? String(area.value.length) : "";
      grow();
      quietEdit(function () {
        onChange(area.value);
      });
    };

    setTimeout(grow, 0);

    var head = el("span", { class: "lp-field-head" }, [
      labelSpan(label),
      el("span", { class: "lp-row", style: "gap:8px" }, [
        count,
        copyButton(function () {
          return area.value;
        }),
      ]),
    ]);
    return el("label", { class: "lp-field" }, [head, area]);
  }

  /**
   * A row of buttons instead of a select. The native one renders an operating
   * system menu that cannot be styled, and on a dark panel that lands as a
   * white rectangle.
   */
  function choiceField(label, value, options, onChange) {
    var row = el(
      "div",
      { class: "lp-row", style: "gap:4px" },
      options.map(function (option) {
        return button(option.name, "lp-btn" + (option.id === value ? " is-on" : ""), function () {
          edit(function () {
            onChange(option.id);
          });
        });
      }),
    );
    return el("div", { class: "lp-field" }, [labelSpan(label), row]);
  }

  /* ------------------------------------------------------------- shell */

  var statusNode = null;

  function paintStatus() {
    if (!statusNode) return;
    statusNode.textContent =
      saveState === "saving" ? "saving" : saveState === "saved" ? "saved" : saveState === "error" ? "not saved" : "";
    statusNode.style.color = saveState === "error" ? "var(--lp-danger)" : "";
  }

  function header() {
    statusNode = el("span", { class: "lp-meta" });
    paintStatus();

    return el("header", { class: "lp-bar" }, [
      el("span", { class: "lp-wordmark", text: "LAUNCH" }),
      el(
        "nav",
        { class: "lp-tabs" },
        TABS.map(function (id) {
          return button(id, "lp-btn is-bare" + (tab === id ? " is-on" : ""), function () {
            tab = id;
            render();
          });
        }),
      ),
      el("span", { class: "lp-right" }, [
        statusNode,
        el("span", { class: "lp-meta", text: backend }),
        button("lock", "lp-btn is-bare", function () {
          fetch("/api/admin/session", { method: "DELETE" }).then(function () {
            location.reload();
          });
        }),
      ]),
    ]);
  }

  /* ---------------------------------------------------------- channels */

  function channelsView() {
    var shown = state.channels.filter(function (channel) {
      return waveFilter === "all" || channel.wave === waveFilter;
    });

    var counts = { posted: 0, ready: 0, todo: 0 };
    state.channels.forEach(function (channel) {
      if (channel.status === "posted") counts.posted += 1;
      else if (channel.status === "ready" || channel.status === "scheduled") counts.ready += 1;
      else if (channel.status === "todo") counts.todo += 1;
    });

    var filters = el(
      "div",
      { class: "lp-row", style: "gap:4px" },
      ["all"].concat(WAVES).map(function (id) {
        return button(id === "all" ? "all" : "wave " + id, "lp-btn" + (waveFilter === id ? " is-on" : ""), function () {
          waveFilter = id;
          render();
        });
      }),
    );

    var tally = el("span", { class: "lp-right lp-num", style: "font-size:11px;color:var(--lp-dim);gap:12px" }, [
      el("span", { style: "color:var(--lp-accent)", text: counts.posted + " posted" }),
      el("span", { text: counts.ready + " ready" }),
      el("span", { text: counts.todo + " to write" }),
    ]);

    var list = el("ul", { class: "lp-list" }, []);

    shown.forEach(function (channel) {
      list.appendChild(channelItem(channel));
    });
    if (shown.length === 0) {
      list.appendChild(el("li", { class: "lp-empty", text: "nothing in this wave yet" }));
    }

    var add = button("add channel", "lp-btn", function () {
      edit(function () {
        state.channels.push({
          id: crypto.randomUUID(),
          name: "",
          group: "",
          url: "",
          wave: waveFilter === "all" ? 1 : waveFilter,
          status: "todo",
          scheduledAt: "",
          postedUrl: "",
          rules: "",
          title: "",
          body: "",
          notes: "",
          result: "",
        });
      });
    });
    add.style.alignSelf = "flex-start";

    return el("div", { class: "lp-stack" }, [el("div", { class: "lp-row" }, [filters, tally]), list, add]);
  }

  function channelItem(channel) {
    var expanded = openChannel === channel.id;

    var dotClass =
      "lp-dot" + (channel.status === "posted" ? " is-posted" : channel.status === "skipped" ? " is-skipped" : "");

    var head = el(
      "button",
      {
        type: "button",
        class: "lp-item-head",
        onClick: function () {
          openChannel = expanded ? null : channel.id;
          render();
        },
      },
      [
        el("span", { class: dotClass, text: channel.status === "posted" ? "●" : "○" }),
        el("span", { text: channel.name || "untitled" }),
        el("span", { class: "lp-meta", text: channel.group }),
        el("span", { class: "lp-right lp-meta" }, [
          channel.scheduledAt ? el("span", { class: "lp-num", text: channel.scheduledAt }) : null,
          el("span", { text: "w" + channel.wave }),
        ]),
      ],
    );

    var item = el("li", { class: "lp-item" }, [head]);
    if (!expanded) return item;

    function set(key) {
      return function (value) {
        channel[key] = value;
      };
    }

    var body = el("div", { class: "lp-item-body" }, [
      el("div", { class: "lp-grid is-two" }, [
        textField("name", channel.name, set("name")),
        textField("group", channel.group, set("group")),
        textField("where to post", channel.url, set("url"), { placeholder: "https://" }),
        textField("scheduled", channel.scheduledAt, set("scheduledAt"), { placeholder: "2026-07-28" }),
      ]),
      el("div", { class: "lp-grid is-two" }, [
        choiceField(
          "status",
          channel.status,
          STATUSES.map(function (id) {
            return { id: id, name: id };
          }),
          set("status"),
        ),
        choiceField(
          "wave",
          channel.wave,
          WAVES.map(function (id) {
            return { id: id, name: "wave " + id };
          }),
          set("wave"),
        ),
      ]),
      channel.rules
        ? el("div", { class: "lp-note" }, [
            labelSpan("rules that get you removed"),
            el("p", { text: channel.rules }),
          ])
        : null,
      textField("title or subject", channel.title, set("title"), { copy: true }),
      areaField("post body", channel.body, set("body"), 8),
      areaField("rules", channel.rules, set("rules"), 2),
      areaField("notes", channel.notes, set("notes"), 2),
      el("div", { class: "lp-grid is-two" }, [
        textField("link to the live post", channel.postedUrl, set("postedUrl"), { placeholder: "https://" }),
        textField("what it did", channel.result, set("result"), { placeholder: "42 points, 12 comments" }),
      ]),
      el("div", { class: "lp-row" }, [
        copyButton(function () {
          return channel.title + "\n\n" + channel.body;
        }, "copy title and body"),
        (function () {
          var remove = button("delete", "lp-btn is-bare is-danger", function () {
            openChannel = null;
            edit(function () {
              state.channels = state.channels.filter(function (c) {
                return c.id !== channel.id;
              });
            });
          });
          remove.style.marginLeft = "auto";
          return remove;
        })(),
      ]),
    ]);

    item.appendChild(body);
    return item;
  }

  /* ------------------------------------------------------------- tasks */

  function tasksView() {
    var list = el("ul", { class: "lp-list" }, []);

    state.tasks.forEach(function (task) {
      var due = el("input", { class: "lp-cell is-num lp-right", value: task.due, placeholder: "due" });
      due.oninput = function () {
        quietEdit(function () {
          task.due = due.value;
        });
      };

      list.appendChild(
        el("li", { class: "lp-item lp-row", style: "padding:8px 12px" }, [
          (function () {
            var toggle = button(task.done ? "●" : "○", "lp-btn is-bare", function () {
              edit(function () {
                task.done = !task.done;
              });
            });
            toggle.setAttribute("aria-label", task.done ? "mark as open" : "mark as done");
            if (task.done) toggle.style.color = "var(--lp-accent)";
            return toggle;
          })(),
          el("span", { class: task.done ? "lp-done" : "", text: task.text }),
          due,
          button("x", "lp-btn is-bare is-danger", function () {
            edit(function () {
              state.tasks = state.tasks.filter(function (t) {
                return t.id !== task.id;
              });
            });
          }),
        ]),
      );
    });

    if (state.tasks.length === 0) list.appendChild(el("li", { class: "lp-empty", text: "no tasks" }));

    var draft = el("input", {
      class: "lp-input",
      placeholder: "what has to be true before the post goes out",
    });
    function add() {
      var text = draft.value.trim();
      if (!text) return;
      edit(function () {
        state.tasks.push({ id: crypto.randomUUID(), text: text, done: false, due: "" });
      });
    }
    draft.onkeydown = function (event) {
      if (event.key === "Enter") add();
    };

    return el("div", { class: "lp-stack" }, [
      list,
      el("div", { class: "lp-row", style: "gap:8px;flex-wrap:nowrap" }, [draft, button("add", "lp-btn", add)]),
    ]);
  }

  /* ----------------------------------------------------------- metrics */

  function metricsView() {
    var rows = state.metrics.slice().sort(function (a, b) {
      return a.at < b.at ? 1 : -1;
    });

    var head = el(
      "tr",
      {},
      ["date", "stars", "visitors", "signups", "note", ""].map(function (title) {
        return el("th", { class: "lp-label", text: title });
      }),
    );

    var body = el("tbody", {}, []);

    rows.forEach(function (metric) {
      function cell(key, className, numeric) {
        var input = el("input", { class: className, value: metric[key] || "" });
        if (numeric) input.setAttribute("inputmode", "numeric");
        input.oninput = function () {
          quietEdit(function () {
            metric[key] = numeric ? Number(input.value) || 0 : input.value;
          });
        };
        return el("td", numeric === "wide" ? { style: "width:100%" } : {}, [input]);
      }

      body.appendChild(
        el("tr", {}, [
          cell("at", "lp-cell lp-num", false),
          cell("stars", "lp-cell is-num", true),
          cell("visitors", "lp-cell is-num", true),
          cell("signups", "lp-cell is-num", true),
          (function () {
            var input = el("input", { class: "lp-cell", value: metric.note || "" });
            input.oninput = function () {
              quietEdit(function () {
                metric.note = input.value;
              });
            };
            return el("td", { style: "width:100%" }, [input]);
          })(),
          el("td", {}, [
            button("x", "lp-btn is-bare is-danger", function () {
              edit(function () {
                state.metrics = state.metrics.filter(function (m) {
                  return m.id !== metric.id;
                });
              });
            }),
          ]),
        ]),
      );
    });

    var add = button("add reading", "lp-btn", function () {
      edit(function () {
        state.metrics.push({
          id: crypto.randomUUID(),
          at: new Date().toISOString().slice(0, 10),
          stars: 0,
          visitors: 0,
          signups: 0,
          note: "",
        });
      });
    });
    add.style.alignSelf = "flex-start";

    return el("div", { class: "lp-stack" }, [
      el("div", { class: "lp-scroll" }, [el("table", { class: "lp-table" }, [el("thead", {}, [head]), body])]),
      add,
    ]);
  }

  /* -------------------------------------------------------------- data */

  /**
   * Import and export.
   *
   * This is how the board is seeded without the seed ever entering the
   * repository: write the JSON locally, paste it in here once against the
   * production panel. It is also the backup, which a single blob at a fixed
   * path otherwise does not have.
   */
  function dataView() {
    var summary =
      state.channels.length +
      " channels, " +
      state.tasks.length +
      " tasks, " +
      state.metrics.length +
      " readings. Last saved " +
      (state.updatedAt || "never") +
      ".";

    var exportBlock = el("div", { class: "lp-field" }, [
      el("span", { class: "lp-field-head" }, [
        labelSpan("export"),
        copyButton(function () {
          return JSON.stringify(state, null, 2);
        }, "copy everything"),
      ]),
      el("p", { style: "margin:0;font-size:12px;color:var(--lp-mute)", text: summary }),
    ]);

    var area = el("textarea", { class: "lp-area", rows: "8", placeholder: "paste a board export" });
    area.value = importDraft;
    area.oninput = function () {
      importDraft = area.value;
      importError = "";
      errorNode.textContent = "";
    };

    var errorNode = el("span", { style: "font-size:11px;color:var(--lp-danger)", text: importError });

    var replace = button("replace board", "lp-btn", function () {
      var parsed;
      try {
        parsed = JSON.parse(area.value);
      } catch (e) {
        importError = "that is not valid json";
        errorNode.textContent = importError;
        return;
      }
      importDraft = "";
      edit(function () {
        state = parsed;
      });
    });
    replace.style.alignSelf = "flex-start";

    var importBlock = el("div", { class: "lp-field" }, [
      el("span", { class: "lp-field-head" }, [labelSpan("import (replaces everything)")]),
      area,
      errorNode,
      replace,
    ]);

    return el("div", { class: "lp-stack", style: "gap:24px" }, [exportBlock, importBlock]);
  }

  /* ------------------------------------------------------------ render */

  function render() {
    root.textContent = "";
    root.appendChild(header());
    var main = el("main", { class: "lp-main" }, [
      tab === "channels" ? channelsView() : tab === "tasks" ? tasksView() : tab === "metrics" ? metricsView() : dataView(),
    ]);
    root.appendChild(main);
  }

  render();
})();
`;
