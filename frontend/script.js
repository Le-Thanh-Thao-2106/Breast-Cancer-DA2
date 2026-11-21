const API_URL = "https://breast-cancer-da2-api.onrender.com";

const featureNames = [
    "mean radius",
    "mean texture",
    "mean perimeter",
    "mean area",
    "mean smoothness",
    "mean compactness",
    "mean concavity",
    "mean concave points",
    "mean symmetry",
    "mean fractal dimension",

    "radius error",
    "texture error",
    "perimeter error",
    "area error",
    "smoothness error",
    "compactness error",
    "concavity error",
    "concave points error",
    "symmetry error",
    "fractal dimension error",

    "worst radius",
    "worst texture",
    "worst perimeter",
    "worst area",
    "worst smoothness",
    "worst compactness",
    "worst concavity",
    "worst concave points",
    "worst symmetry",
    "worst fractal dimension"
];

const sampleValues = [
    17.99,
    10.38,
    122.8,
    1001.0,
    0.11840,
    0.27760,
    0.30010,
    0.14710,
    0.2419,
    0.07871,

    1.095,
    0.9053,
    8.589,
    153.40,
    0.006399,
    0.04904,
    0.05373,
    0.01587,
    0.03003,
    0.006193,

    25.38,
    17.33,
    184.6,
    2019.0,
    0.1622,
    0.6656,
    0.7119,
    0.2654,
    0.4601,
    0.11890
];

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
    label.textContent = `${index + 1}. ${featureName} (${window.FEATURE_TRANSLATIONS[index]})`;

    const input = document.createElement("input");

    input.type = "number";
    input.step = "any";
    input.required = true;
    input.name = featureName;
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


/* Mẫu minh họa lấy từ 6 dòng đầu trong file CSV thử nghiệm kèm dự án. */
const demoSamples = [[17.99, 10.38, 122.8, 1001.0, 0.1184, 0.2776, 0.3001, 0.1471, 0.2419, 0.07871, 1.095, 0.9053, 8.589, 153.4, 0.006399, 0.04904, 0.05373, 0.01587, 0.03003, 0.006193, 25.38, 17.33, 184.6, 2019.0, 0.1622, 0.6656, 0.7119, 0.2654, 0.4601, 0.1189], [20.57, 17.77, 132.9, 1326.0, 0.08474, 0.07864, 0.0869, 0.07017, 0.1812, 0.05667, 0.5435, 0.7339, 3.398, 74.08, 0.005225, 0.01308, 0.0186, 0.0134, 0.01389, 0.003532, 24.99, 23.41, 158.8, 1956.0, 0.1238, 0.1866, 0.2416, 0.186, 0.275, 0.08902], [19.69, 21.25, 130.0, 1203.0, 0.1096, 0.1599, 0.1974, 0.1279, 0.2069, 0.05999, 0.7456, 0.7869, 4.585, 94.03, 0.00615, 0.04006, 0.03832, 0.02058, 0.0225, 0.004571, 23.57, 25.53, 152.5, 1709.0, 0.1444, 0.4245, 0.4504, 0.243, 0.3613, 0.08758], [11.42, 20.38, 77.58, 386.1, 0.1425, 0.2839, 0.2414, 0.1052, 0.2597, 0.09744, 0.4956, 1.156, 3.445, 27.23, 0.00911, 0.07458, 0.05661, 0.01867, 0.05963, 0.009208, 14.91, 26.5, 98.87, 567.7, 0.2098, 0.8663, 0.6869, 0.2575, 0.6638, 0.173], [20.29, 14.34, 135.1, 1297.0, 0.1003, 0.1328, 0.198, 0.1043, 0.1809, 0.05883, 0.7572, 0.7813, 5.438, 94.44, 0.01149, 0.02461, 0.05688, 0.01885, 0.01756, 0.005115, 22.54, 16.67, 152.2, 1575.0, 0.1374, 0.205, 0.4, 0.1625, 0.2364, 0.07678], [12.45, 15.7, 82.57, 477.1, 0.1278, 0.17, 0.1578, 0.08089, 0.2087, 0.07613, 0.3345, 0.8902, 2.217, 27.19, 0.00751, 0.03345, 0.03672, 0.01137, 0.02165, 0.005082, 15.47, 23.75, 103.4, 741.6, 0.1791, 0.5249, 0.5355, 0.1741, 0.3985, 0.1244]];
const picker = document.createElement('div');picker.className='sample-picker';
const pickerLabel=document.createElement('label');pickerLabel.textContent='Chọn bộ dữ liệu thử';pickerLabel.htmlFor='sampleChoice';
const sampleSelect=document.createElement('select');sampleSelect.id='sampleChoice';
demoSamples.forEach((_,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent='Mẫu nghiên cứu '+(i+1);sampleSelect.append(o)});
const sampleButton=document.createElement('button');sampleButton.type='button';sampleButton.textContent='Điền dữ liệu mẫu';
picker.append(pickerLabel,sampleSelect,sampleButton);form.insertBefore(picker,meanFeaturesContainer.parentElement);
sampleButton.addEventListener('click',()=>{const values=demoSamples[Number(sampleSelect.value)];form.querySelectorAll('input').forEach((input,index)=>{if(index<values.length)input.value=values[index]});resultContainer.textContent='Đã điền mẫu '+(Number(sampleSelect.value)+1)+'. Nhấn Phân loại để chạy mô hình.'});

/* =========================
   GỬI DỮ LIỆU ĐẾN API
========================= */

form.addEventListener("submit", async (event) => {

    event.preventDefault();

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
                        ${data.model_version}
                    </div>

                </div>

                <div class="warning">
                    ⚠️ ${data.warning}
                </div>

            </div>
        `;
        if(compareData.results.length>1){
            const heading=document.createElement('h3');heading.textContent='So sánh dự đoán giữa các kernel';
            const table=document.createElement('table');table.className='bc-compare-table';
            table.innerHTML='<tr><th>Kernel</th><th>Phân loại</th><th>Ác tính</th><th>Lành tính</th><th>Suy luận (ms)</th></tr>';
            compareData.results.forEach(item=>{const v=item.predictions[0],tr=document.createElement('tr');[item.kernel,v.predicted_label,(v.probability_malignant*100).toFixed(2)+'%',(v.probability_benign*100).toFixed(2)+'%',item.elapsed_ms.toFixed(3)].forEach(x=>{const td=document.createElement('td');td.textContent=x;tr.append(td)});table.append(tr)});
            resultContainer.append(heading,table);
        }


    } catch (error) {

        resultContainer.innerHTML = `

            <div class="warning">

                <strong>Không thể kết nối API.</strong>

                <p>
                    ${error.message}
                </p>

                <p>
                    Hãy kiểm tra FastAPI đang chạy tại
                    <strong>${API_URL}</strong>
                </p>

            </div>

        `;

        console.error("Prediction error:", error);

    } finally {

        predictButton.disabled = false;
        predictButton.textContent = "Phân loại";

    }

});