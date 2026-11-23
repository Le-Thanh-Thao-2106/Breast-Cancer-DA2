const BatchResults = (() => {
    const pageSize = 20;

    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    function label(value) {
        if (value === 0) return "Ác tính (0)";
        if (value === 1) return "Lành tính (1)";
        return "—";
    }

    function percent(value) {
        return typeof value === "number" && Number.isFinite(value)
            ? `${(value * 100).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`
            : "—";
    }

    function table(headers, rows) {
        const wrapper = element("div", undefined, "research-table-scroll");
        wrapper.tabIndex = 0;
        const table = element("table", undefined, "research-table");
        const heading = table.createTHead().insertRow();
        headers.forEach(name => {
            const cell = element("th", name);
            cell.scope = "col";
            heading.append(cell);
        });
        const body = table.createTBody();
        rows.forEach(values => {
            const row = body.insertRow();
            values.forEach(value => {
                const cell = row.insertCell();
                if (value instanceof Node) cell.append(value);
                else cell.textContent = value ?? "—";
            });
        });
        wrapper.append(table);
        return wrapper;
    }

    function summarize(run, labels) {
        const malignant = run.predictions.filter(row => row.predicted_class === 0).length;
        const result = { kernel: run.kernel, malignant, benign: run.predictions.length - malignant, elapsed_ms: run.elapsed_ms };
        if (labels) {
            const incorrectByLabel = [0, 0];
            run.predictions.forEach((row, index) => {
                const actual = labels[index];
                if (row.predicted_class !== actual) incorrectByLabel[actual]++;
            });
            const incorrect = incorrectByLabel[0] + incorrectByLabel[1];
            const correct = run.predictions.length - incorrect;
            result.evaluation = { correct, incorrect, accuracy: correct / run.predictions.length, incorrectByLabel };
        }
        return result;
    }

    function renderDetails(target, session, { activeKernel, onKernel, onInspect } = {}) {
        const runs = session.results || [];
        const labels = session.labels;
        const selected = runs.find(run => run.kernel === activeKernel) || runs[0];
        if (!selected) {
            target.replaceChildren(element("p", "Phiên này không có dự đoán theo từng mẫu."));
            return;
        }

        let page = 0;
        let filter = "all";
        let run = selected;
        let groups;
        const bar = element("div", undefined, "research-result-toolbar");
        const picker = element("select");
        picker.setAttribute("aria-label", "Kernel để xem kết quả");
        runs.forEach(run => picker.add(new Option(run.kernel, run.kernel)));
        picker.value = selected.kernel;
        const heading = element("label", "Kernel");
        heading.append(picker);
        bar.append(heading);
        const output = element("div");
        const body = element("div", undefined, labels ? "research-labeled-results" : undefined);
        const errors = element("div", undefined, "research-label-errors");
        const filterButtons = [];

        if (labels) {
            const filters = element("div", undefined, "research-result-filters");
            filters.setAttribute("role", "group");
            filters.setAttribute("aria-label", "Lọc theo kết quả so với nhãn thật");
            for (const [mode, title] of [["all", "Tất cả"], ["correct", "Đúng"], ["incorrect", "Sai"]]) {
                const button = element("button", title);
                button.type = "button";
                button.onclick = () => {
                    filter = mode;
                    page = 0;
                    filterButtons.forEach(({ button, mode }) => button.setAttribute("aria-pressed", String(mode === filter)));
                    renderPage();
                };
                filterButtons.push({ button, mode, title });
                filters.append(button);
            }
            bar.append(filters);
            body.append(errors);
        }
        body.append(output);

        function updateKernel() {
            groups = { all: [], correct: [], incorrect: [] };
            run.predictions.forEach((row, index) => {
                groups.all.push(index);
                if (labels) groups[row.predicted_class === labels[index] ? "correct" : "incorrect"].push(index);
            });
            if (!labels) return;
            filterButtons.forEach(({ button, mode, title }) => {
                button.textContent = `${title} · ${groups[mode].length}`;
                button.setAttribute("aria-pressed", String(mode === filter));
            });
            const { incorrectByLabel } = summarize(run, labels).evaluation;
            errors.replaceChildren(...["Ác tính → Lành tính", "Lành tính → Ác tính"].map((description, index) => {
                const card = element("div", undefined, "research-label-error-card");
                card.append(element("span", `Nhãn thật ${index} dự đoán sai`),
                    element("strong", incorrectByLabel[index]), element("small", description));
                return card;
            }));
        }

        function renderPage() {
            const first = page * pageSize;
            const indexes = groups[filter];
            const total = indexes.length;
            if (!total) {
                const empty = element("p", filter === "incorrect" ? "Kernel này không có mẫu dự đoán sai." : "Không có mẫu phù hợp.");
                empty.setAttribute("role", "status");
                output.replaceChildren(empty);
                return;
            }
            const headers = labels
                ? ["STT", "Nhãn thật", "Dự đoán", "Ác tính", "Lành tính", "Đúng/Sai"]
                : ["STT", "Dự đoán", "Ác tính", "Lành tính"];
            if (onInspect) headers.push("Đầu vào");
            const rows = indexes.slice(first, first + pageSize).map(index => {
                const row = run.predictions[index];
                const values = [index + 1];
                if (labels) values.push(label(labels[index]));
                values.push(label(row.predicted_class), percent(row.probability_malignant), percent(row.probability_benign));
                if (labels) {
                    const match = labels[index] === row.predicted_class;
                    values.push(element("span", match ? "Đúng" : "Sai", `research-match ${match ? "is-correct" : "is-incorrect"}`));
                }
                if (onInspect) {
                    const inspect = element("button", "Xem 30 đặc trưng", "secondary-button research-compact-button");
                    inspect.type = "button";
                    inspect.setAttribute("aria-label", `Xem 30 đặc trưng của mẫu ${index + 1}`);
                    inspect.onclick = () => onInspect(index);
                    values.push(inspect);
                }
                return values;
            });
            const pager = element("div", undefined, "research-pager");
            const back = element("button", "Trước", "secondary-button research-compact-button");
            const next = element("button", "Sau", "secondary-button research-compact-button");
            back.type = next.type = "button";
            back.disabled = page === 0;
            next.disabled = first + pageSize >= total;
            back.onclick = () => { page--; renderPage(); };
            next.onclick = () => { page++; renderPage(); };
            const pageMessage = element("span", total ? `${first + 1}–${Math.min(first + pageSize, total)} / ${total} mẫu` : "0 mẫu");
            pageMessage.setAttribute("aria-live", "polite");
            pager.append(pageMessage, back, next);
            output.replaceChildren(table(headers, rows), pager);
        }

        picker.onchange = () => {
            run = runs.find(item => item.kernel === picker.value);
            page = 0;
            updateKernel();
            renderPage();
            onKernel?.(picker.value);
        };
        target.replaceChildren(bar, body);
        updateKernel();
        renderPage();
    }

    function renderComparison(target, session) {
        const runs = session.results || [];
        const labels = session.labels;
        const summary = runs.length ? runs.map(run => summarize(run, labels)) : session.summary || [];
        const evaluate = Boolean(labels || summary.some(row => row.evaluation));
        const headers = evaluate
            ? ["Kernel", "Đúng", "Tổng sai", "Sai nhãn 0", "Sai nhãn 1", "Tỷ lệ khớp", "Suy luận (ms)"]
            : ["Kernel", "Ác tính", "Lành tính", "Suy luận (ms)"];
        const rows = summary.map(row => {
            const elapsed = typeof row.elapsed_ms === "number" ? row.elapsed_ms.toFixed(3) : row.elapsed_ms;
            const evaluation = row.evaluation;
            return evaluate
                ? [row.kernel, evaluation?.correct, evaluation?.incorrect, evaluation?.incorrectByLabel?.[0],
                   evaluation?.incorrectByLabel?.[1], percent(evaluation?.accuracy), elapsed]
                : [row.kernel, row.malignant, row.benign, elapsed];
        });
        target.replaceChildren(element("h3", "So sánh các kernel đã chọn"), table(headers, rows));
    }

    return { element, label, percent, summarize, renderDetails, renderComparison };
})();
