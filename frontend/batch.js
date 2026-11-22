const batchFeatureNames=['mean radius','mean texture','mean perimeter','mean area','mean smoothness','mean compactness','mean concavity','mean concave points','mean symmetry','mean fractal dimension','radius error','texture error','perimeter error','area error','smoothness error','compactness error','concavity error','concave points error','symmetry error','fractal dimension error','worst radius','worst texture','worst perimeter','worst area','worst smoothness','worst compactness','worst concavity','worst concave points','worst symmetry','worst fractal dimension'];
let batchRows=[],batchRuns=[],activeKernel='',batchFilename='';const $=id=>document.getElementById(id),msg=t=>$('batchMessage').textContent=t;
function parseCSV(text){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(field);field=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field=''}else field+=c}if(quoted)throw Error('Dấu ngoặc kép chưa đóng');row.push(field);if(row.some(x=>x.trim()))rows.push(row);return rows}

async function readDataFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv") {
        const text = (await file.text()).replace(/^\uFEFF/, "");
        return parseCSV(text);
    }

    if (ext === "txt") {
        const text = (await file.text()).replace(/^\uFEFF/, "");
        const firstLine = text.split(/\r?\n/).find(x => x.trim()) || "";

        // TXT có thể phân cách bằng tab hoặc dấu phẩy.
        if (firstLine.includes("\t")) {
            return text
                .split(/\r?\n/)
                .filter(line => line.trim())
                .map(line => line.split("\t"));
        }

        return parseCSV(text);
    }

    if (ext === "xlsx" || ext === "xls") {
        if (typeof XLSX === "undefined") {
            throw new Error("Chưa tải thư viện đọc Excel");
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        if (!sheet) {
            throw new Error("Không tìm thấy trang tính");
        }

        return XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
            raw: false
        });
    }

    throw new Error("Chỉ hỗ trợ CSV, TXT, XLSX và XLS");
}

function csvCell(v){const s=String(v??'');return /^[=+@-]/.test(s)?'"\t'+s.replace(/"/g,'""')+'"':/[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function downloadCSV(filename,rows){const blob=new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('downloadTemplate').onclick=()=>{const a=document.createElement('a');a.href='breast-cancer-mau-20-dong.csv';a.download=a.href;a.click()};
$('csvFile').onchange=async e=>{batchRows=[];batchRuns=[];$('runBatch').disabled=true;$('exportBatch').disabled=true;$('batchPreview').replaceChildren();const file=e.target.files?.[0];if(!file)return;batchFilename=file.name;try{if(file.size>2e6)throw Error('File vượt quá 2 MB');const raw = await readDataFile(file);if(raw.length<2)throw Error('File cần tiêu đề và dữ liệu');const headers=raw[0].map(x=>x.trim());if(new Set(headers).size!==headers.length)throw Error('Tên cột trùng');const missing=batchFeatureNames.filter(x=>!headers.includes(x));if(missing.length)throw Error('Thiếu cột: '+missing.join(', '));if(raw.length-1>200)throw Error('Tối đa 200 mẫu/lần');batchRows=raw.slice(1).map((r,i)=>{if(r.length!==headers.length)throw Error('Dòng '+(i+2)+' sai số cột');const obj={};batchFeatureNames.forEach(k=>{const val=r[headers.indexOf(k)].trim(),n=Number(val);if(!val||!Number.isFinite(n))throw Error('Sai dữ liệu dòng '+(i+2)+', cột '+k);obj[k]=n});return obj});msg('Đã đọc '+batchRows.length+' mẫu từ '+file.name);$('runBatch').disabled=false}catch(err){msg('Lỗi đọc file: ' + err.message)}};
function showKernel(kernel){const run=batchRuns.find(r=>r.kernel===kernel);if(!run)return;activeKernel=kernel;const predictions=run.predictions;document.getElementById('batchMalignant').textContent=predictions.filter(r=>r.predicted_class===0).length;document.getElementById('batchBenign').textContent=predictions.filter(r=>r.predicted_class===1).length;const target=$('batchPreview');target.replaceChildren();const toolbar=document.createElement('div');toolbar.className='bc-batch-toolbar';const label=document.createElement('strong');label.textContent='Bảng chi tiết của kernel:';const select=document.createElement('select');select.setAttribute('aria-label','Chọn kernel để xem bảng kết quả');batchRuns.forEach(r=>{const o=document.createElement('option');o.value=r.kernel;o.textContent=r.kernel;select.append(o)});select.value=kernel;select.onchange=()=>showKernel(select.value);toolbar.append(label,select);const note=document.createElement('small');note.textContent='Số liệu phía dưới thuộc kernel '+kernel+'; chọn kernel khác để đối chiếu.';toolbar.append(note);target.append(toolbar);const table=document.createElement('table');table.className='batch-table';const head=document.createElement('tr');['STT','Kết quả ('+kernel+')','Ác tính','Lành tính'].forEach(x=>{const th=document.createElement('th');th.textContent=x;head.append(th)});table.append(head);predictions.forEach((d,i)=>{const tr=document.createElement('tr');[i+1,d.predicted_label,(d.probability_malignant*100).toFixed(2)+'%',(d.probability_benign*100).toFixed(2)+'%'].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td)});table.append(tr)});target.append(table);if(batchRuns.length>1){const h=document.createElement('h3');h.textContent='So sánh các kernel đã chọn';target.append(h);const comparison=document.createElement('table');comparison.className='bc-compare-table';const tr=document.createElement('tr');['Kernel','Ác tính','Lành tính','Suy luận (ms)','Khác '+kernel].forEach(x=>{const th=document.createElement('th');th.textContent=x;tr.append(th)});comparison.append(tr);batchRuns.forEach(r=>{const row=document.createElement('tr'),diff=r.predictions.filter((x,i)=>x.predicted_class!==predictions[i].predicted_class).length;[r.kernel,r.predictions.filter(x=>x.predicted_class===0).length,r.predictions.filter(x=>x.predicted_class===1).length,r.elapsed_ms.toFixed(3),diff+' mẫu'].forEach(v=>{const td=document.createElement('td');td.textContent=v;row.append(td)});comparison.append(row)});target.append(comparison)}}
$('runBatch').onclick=async()=>{if(!batchRows.length)return;$('runBatch').disabled=true;msg('Đang phân tích...');const started=performance.now();try{const kernels=[...document.querySelectorAll('#batchKernelOptions input:checked')].map(x=>x.value);if(!kernels.length)throw Error('Chọn ít nhất một kernel');const res=await fetch('/predict/batch/compare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({samples:batchRows,kernels})});const data=await res.json();if(!res.ok)throw Error(JSON.stringify(data.detail||data));batchRuns=data.results;activeKernel=batchRuns[0].kernel;$('batchMetrics').hidden=false;$('batchCount').textContent=batchRows.length;$('batchTime').textContent=(performance.now()-started).toFixed(1)+' ms';showKernel(activeKernel);$('exportBatch').disabled=false;const session={id:'batch_'+Date.now(),type:'batch',analyzedAt:new Date().toISOString(),filename:batchFilename,sampleCount:batchRows.length,kernels:batchRuns.map(r=>r.kernel),summary:batchRuns.map(r=>({kernel:r.kernel,malignant:r.predictions.filter(p=>p.predicted_class===0).length,benign:r.predictions.filter(p=>p.predicted_class===1).length,elapsed_ms:r.elapsed_ms})),results:batchRuns.map(r=>({kernel:r.kernel,predictions:r.predictions}))};const key=getUserHistoryKey(),history=JSON.parse(localStorage.getItem(key)||'[]');localStorage.setItem(key,JSON.stringify([session,...(Array.isArray(history)?history:[])].slice(0,300)));if(typeof window.bcSaveCloudSession==='function'){try{await window.bcSaveCloudSession(session);msg('Đã phân tích '+batchRows.length+' mẫu; lưu một phiên trong lịch sử và Supabase.')}catch(e){msg('Đã phân tích và lưu cục bộ. Chưa đồng bộ Supabase: '+e.message)}}else msg('Đã phân tích '+batchRows.length+' mẫu; lưu thành một phiên trong lịch sử cục bộ.')}catch(e){msg('Không thể phân tích: '+e.message)}finally{$('runBatch').disabled=false}};
$('exportBatch').onclick=()=>{if(!batchRuns.length)return;const cols=batchRuns.flatMap(r=>[r.kernel+'_class',r.kernel+'_label',r.kernel+'_malignant',r.kernel+'_benign']);downloadCSV('breast-cancer-compare.csv',[[...batchFeatureNames,...cols],...batchRows.map((row,i)=>[...batchFeatureNames.map(k=>row[k]),...batchRuns.flatMap(r=>{const p=r.predictions[i];return[p.predicted_class,p.predicted_label,p.probability_malignant,p.probability_benign]})])])};
