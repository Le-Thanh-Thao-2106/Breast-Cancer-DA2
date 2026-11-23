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
            const correct = run.predictions.filter((row, index) => row.predicted_class === labels[index]).length;
            result.evaluation = run.evaluation || { correct, incorrect: labels.length - correct, accuracy: correct / labels.length };
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
        const bar = element("div", undefined, "research-result-toolbar");
        const picker = element("select");
        picker.setAttribute("aria-label", "Kernel để xem kết quả");
        runs.forEach(run => picker.add(new Option(run.kernel, run.kernel)));
        picker.value = selected.kernel;
        const heading = element("label", "Kernel");
        heading.append(picker);
        bar.append(heading);
        const output = element("div");

        function renderPage() {
            const run = runs.find(item => item.kernel === picker.value);
            const first = page * pageSize;
            const total = run.predictions.length;
            const headers = labels
                ? ["STT", "Nhãn thật", "Dự đoán", "Ác tính", "Lành tính", "Đúng/Sai"]
                : ["STT", "Dự đoán", "Ác tính", "Lành tính"];
            if (onInspect) headers.push("Đầu vào");
            const rows = run.predictions.slice(first, first + pageSize).map((row, offset) => {
                const index = first + offset;
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
            page = 0;
            renderPage();
            onKernel?.(picker.value);
        };
        target.replaceChildren(bar, output);
        renderPage();
    }

    function renderComparison(target, session, activeKernel) {
        const runs = session.results || [];
        const reference = runs.find(run => run.kernel === activeKernel) || runs[0];
        const labels = session.labels;
        const summary = runs.length ? runs.map(run => summarize(run, labels)) : session.summary || [];
        const evaluate = Boolean(labels || summary.some(row => row.evaluation));
        const headers = evaluate
            ? ["Kernel", "Đúng", "Sai", "Tỷ lệ khớp", "Suy luận (ms)"]
            : ["Kernel", "Ác tính", "Lành tính", "Suy luận (ms)"];
        if (reference) headers.push(`Khác ${reference.kernel}`);
        const rows = summary.map(row => {
            const elapsed = typeof row.elapsed_ms === "number" ? row.elapsed_ms.toFixed(3) : row.elapsed_ms;
            const cells = evaluate
                ? [row.kernel, row.evaluation?.correct, row.evaluation?.incorrect, percent(row.evaluation?.accuracy), elapsed]
                : [row.kernel, row.malignant, row.benign, elapsed];
            if (reference) {
                const run = runs.find(item => item.kernel === row.kernel);
                cells.push(run.predictions.filter((item, index) => item.predicted_class !== reference.predictions[index]?.predicted_class).length);
            }
            return cells;
        });
        target.replaceChildren(element("h3", "So sánh các kernel đã chọn"), table(headers, rows));
    }

    return { element, label, percent, summarize, renderDetails, renderComparison };
})();
