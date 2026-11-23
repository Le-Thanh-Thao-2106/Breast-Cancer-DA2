const API_URL = BREASTCARE_API;

const featureNames = window.WDBC_FEATURE_NAMES;

const meanFeaturesContainer = document.getElementById("meanFeatures");
const errorFeaturesContainer = document.getElementById("errorFeatures");
const worstFeaturesContainer = document.getElementById("worstFeatures");
const form = document.getElementById("predictionForm");
const resultContainer = document.getElementById("result");
const predictButton = document.getElementById("predictButton");


/* =========================
   TẠO 30 Ô NHẬP
========================= */

featureNames.forEach((featureName, index) => {

    const group = document.createElement("div");
    group.className = "feature-group";

    const label = document.createElement("label");
    label.textContent = `${featureName} (${window.FEATURE_TRANSLATIONS[index]})`;

    const input = document.createElement("input");

    input.type = "number";
    input.step = "any";
    input.required = true;
    input.name = featureName;
    input.id = `feature-${index + 1}`;
    label.htmlFor = input.id;
    input.placeholder = "Nhập giá trị";

    group.appendChild(label);
    group.appendChild(input);

    if (index < 10) {
        meanFeaturesContainer.appendChild(group);
    } else if (index < 20) {
        errorFeaturesContainer.appendChild(group);
    } else {
        worstFeaturesContainer.appendChild(group);
    }
});


const featureTabs = [...form.querySelectorAll('[role="tab"]')];
function activateFeatureTab(active) {
    featureTabs.forEach(tab => {
        const selected = tab === active;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        document.getElementById(tab.getAttribute("aria-controls")).hidden = !selected;
    });
}
featureTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateFeatureTab(tab));
    tab.addEventListener("keydown", event => {
        const target = {
            ArrowLeft: (index + featureTabs.length - 1) % featureTabs.length,
            ArrowRight: (index + 1) % featureTabs.length,
            Home: 0,
            End: featureTabs.length - 1
        }[event.key];
        if (target === undefined) return;
        event.preventDefault();
        activateFeatureTab(featureTabs[target]);
        featureTabs[target].focus();
    });
});

const sampleSelect = document.getElementById("sampleChoice");
const featureMessage = document.getElementById("featureMessage");
let referenceLabel = null;
window.WDBC_RESEARCH_SAMPLES.forEach((_, index) => {
    sampleSelect.add(new Option(`Mẫu nghiên cứu ${String(index + 1).padStart(2, "0")}`, index));
});
document.getElementById("fillResearchSample").addEventListener("click", () => {
    const sample = window.WDBC_RESEARCH_SAMPLES[Number(sampleSelect.value)];
    featureNames.forEach((name, index) => {
        form.elements.namedItem(name).value = sample.values[index];
    });
    referenceLabel = sample.label;
    featureMessage.textContent = "Đã điền đủ 30 đặc trưng.";
});
form.addEventListener("input", event => {
    if (event.target.matches('input[type="number"]')) referenceLabel = null;
    featureMessage.textContent = "";
});
form.addEventListener("reset", () => {
    referenceLabel = null;
    featureMessage.textContent = "";
    activateFeatureTab(featureTabs[0]);
});

/* =========================
   GỬI DỮ LIỆU ĐẾN API
========================= */

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    const invalidIndex = featureNames.findIndex(name => !form.elements.namedItem(name).validity.valid);
    if (invalidIndex !== -1) {
        const input = form.elements.namedItem(featureNames[invalidIndex]);
        activateFeatureTab(featureTabs[Math.floor(invalidIndex / 10)]);
        featureMessage.textContent = `Kiểm tra đặc trưng ${featureNames[invalidIndex]}.`;
        input.focus();
        input.reportValidity();
        return;
    }
    const labelAtSubmit = referenceLabel;
    predictButton.disabled = true;
    predictButton.textContent = "Đang xử lý...";

    resultContainer.innerHTML = `
        <p class="empty-result">
            Đang gửi dữ liệu đến mô hình SVM...
        </p>
    `;

    try {

        const inputs = form.querySelectorAll("input");

        const features = {};

        inputs.forEach((input) => {
            features[input.name] = Number(input.value);
        });

        const predictionStarted = performance.now();
        const selectedKernels=[...document.querySelectorAll('#kernelOptions input:checked')].map(x=>x.value);
        if(!selectedKernels.length)throw Error('Vui lòng chọn ít nhất một kernel.');
        const response = await fetch(`${API_URL}/predict/compare`, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                features: features, kernels:selectedKernels
            })
        });

        const compareData = await response.json();
        const data = compareData.results?.[0]?.predictions?.[0] || compareData;
        const predictionElapsedMs = performance.now() - predictionStarted;


        /* =========================
           XỬ LÝ LỖI API
        ========================= */

        if (!response.ok) {
            throw new Error(
                data.detail
                    ? JSON.stringify(data.detail)
                    : "API trả về lỗi."
            );
        }


        /* =========================
        LƯU LỊCH SỬ PHÂN TÍCH
        ========================= */

        const historyItem = {
            id: Date.now(),

            analyzedAt: new Date().toISOString(),

            features: { ...features },

            predictedClass: data.predicted_class,
            predictedLabel: data.predicted_label,

            probabilityMalignant: data.probability_malignant,
            probabilityBenign: data.probability_benign,

            modelVersion: "WDBC benchmark", kernel:selectedKernels.join(", ")
        };

        let analysisHistory = [];

        try {
            analysisHistory = JSON.parse(
                localStorage.getItem(getUserHistoryKey()) || "[]"
            );

            if (!Array.isArray(analysisHistory)) {
                analysisHistory = [];
            }
        } catch (error) {
            analysisHistory = [];
        }

        analysisHistory.unshift(historyItem);

        // Giới hạn tối đa 100 lần phân tích
        analysisHistory = analysisHistory.slice(0, 100);

        localStorage.setItem(
            getUserHistoryKey(),
            JSON.stringify(analysisHistory)
        );

        
        try {
            const cloudSession = {
                id: "single_" + Date.now(),
                type: "single",
                analyzedAt: new Date().toISOString(),
                filename: "",
                sampleCount: 1,
                kernels: selectedKernels,

                summary: {
                    predicted_class: data.predicted_class,
                    predicted_label: data.predicted_label,
                    probability_malignant: data.probability_malignant,
                    probability_benign: data.probability_benign,
                    elapsed_ms: predictionElapsedMs
                },

                results: {
                    features: features,
                    predictions: compareData.results
                }
            };

            if (typeof window.bcSaveCloudSession === "function") {
                await window.bcSaveCloudSession(cloudSession);
                console.log("Đã lưu phân tích 1 mẫu lên Supabase");
            } else {
                console.warn("Chưa tải cloud-history.js");
            }
        } catch (error) {
            console.error("Không lưu được lịch sử Supabase:", error);
        }



        /* =========================
           HIỂN THỊ KẾT QUẢ
        ========================= */

        const malignantPercent =
            (data.probability_malignant * 100).toFixed(2);

        const benignPercent =
            (data.probability_benign * 100).toFixed(2);

        resultContainer.innerHTML = `

            <div class="result-success">

                <h3>
                    Kết quả: ${data.predicted_label}
                </h3>

                <p class="bc-inline-message">Thời gian yêu cầu dự đoán: ${predictionElapsedMs.toFixed(1)} ms (bao gồm mạng và API) · Kernel: ${selectedKernels.join(", ")}</p>
                <div class="result-info">

                    <div class="result-item">
                        <strong>Lớp dự đoán</strong>
                        ${data.predicted_class}
                    </div>

                    <div class="result-item">
                        <strong>Malignant</strong>
                        ${malignantPercent}%
                    </div>

                    <div class="result-item">
                        <strong>Benign</strong>
                        ${benignPercent}%
                    </div>

                    <div class="result-item">
                        <strong>Model version</strong>
                        ${(data.model_version || "WDBC")}
                    </div>

                </div>

                <div class="warning">
                    Kết quả phục vụ học tập và nghiên cứu.
                </div>

            </div>
        `;
        if (labelAtSubmit !== null) {
            const reference = document.createElement("p");
            reference.className = "bc-inline-message";
            reference.textContent = `Nhãn thật của mẫu nghiên cứu: ${labelAtSubmit} (${labelAtSubmit === 0 ? "Ác tính" : "Lành tính"}) · ${labelAtSubmit === data.predicted_class ? "Trùng khớp" : "Không trùng khớp"} với ${selectedKernels[0]}.`;
            resultContainer.prepend(reference);
        }
        if(compareData.results.length>1){
            const heading=document.createElement('h3');heading.textContent='So sánh dự đoán giữa các kernel';
            const table=document.createElement('table');table.className='bc-compare-table';
            table.innerHTML='<tr><th>Kernel</th><th>Phân loại</th><th>Ác tính</th><th>Lành tính</th><th>Suy luận (ms)</th></tr>';
            compareData.results.forEach(item=>{const v=item.predictions[0],tr=document.createElement('tr');[item.kernel,v.predicted_label,(v.probability_malignant*100).toFixed(2)+'%',(v.probability_benign*100).toFixed(2)+'%',item.elapsed_ms.toFixed(3)].forEach(x=>{const td=document.createElement('td');td.textContent=x;tr.append(td)});table.append(tr)});
            resultContainer.append(heading,table);
        }


    } catch (error) {

        const warning = document.createElement("p");
        warning.className = "warning";
        warning.textContent = "Không thể phân tích: " + error.message;
        resultContainer.replaceChildren(warning);

        console.error("Prediction error:", error);

    } finally {

        predictButton.disabled = false;
        predictButton.textContent = "Phân tích";

    }

});