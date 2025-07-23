// بيانات المشاركين (للاختيار فقط في نافذة السداد)
const members = [
    "عبد السلام عارف",
    "محمد عبد السلام عارف",
    "وحيد ابو العزايم",
    "حسين ابو العزايم",
    "محمد علي حسين",
    "احمد عادل حسين",
    "محمد ابراهيم حسين",
    "محمود ابراهيم حسين",
    "على عبد السلام عارف",
    "سيف حسين ابو العزايم",
    "محمد وحيد ابو العزايم",
    "هيثم محمود حسين",

];

const firebaseConfig = {
  apiKey: "AIzaSyC-nKV8iCPHojNjQt5d6tBZ20IFj3rE-qA",
  authDomain: "takaful-c8dfc.firebaseapp.com",
  projectId: "takaful-c8dfc",
  storageBucket: "takaful-c8dfc.appspot.com",
  messagingSenderId: "467215377808",
  appId: "1:467215377808:web:5d0cd7570cb6e13fb87f15",
  measurementId: "G-QECKN1ECM3"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let statement = [];
let currentUser = null;
let currentUserData = null;

// تجهيز الأعضاء في نافذة السداد
function fillMemberSelect() {
    const sel = document.getElementById('payment-member');
    sel.innerHTML = '';
    members.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
    });
}

// تجهيز الشهور
function fillMonths() {
    const sel = document.getElementById('payment-month');
    sel.innerHTML = "";
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), i, 1);
        let m = d.toLocaleString('ar-EG', {month: 'long'});
        sel.innerHTML += `<option value="${i+1}">${m} ${now.getFullYear()}</option>`;
    }
}

// تسجيل الدخول
async function login() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    const errorBox = document.getElementById('login-error');
    if (!email || !pass) {
        errorBox.textContent = "من فضلك أدخل البريد وكلمة المرور.";
        return;
    }
    try {
        const u = await auth.signInWithEmailAndPassword(email, pass);
        currentUser = u.user;
        // جلب بيانات المستخدم من Firestore
        const snap = await db.collection("users").doc(currentUser.uid).get();
        if (!snap.exists) {
            errorBox.textContent = "الحساب غير مسجل في قاعدة البيانات.";
            auth.signOut();
            return;
        }
        currentUserData = snap.data();
        errorBox.textContent = "";
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        document.getElementById('user-name').textContent = "مرحباً " + (currentUserData.name || currentUser.email);
        fillMonths();
        fillMemberSelect();
        listenForStatementChanges();
        // إظهار أزرار الأدمن فقط إذا كان الأدمن
        if (currentUserData.isAdmin) {
            document.getElementById('review-requests-btn').classList.remove('hidden');
            document.getElementById('add-expense-btn').classList.remove('hidden');
        } else {
            document.getElementById('review-requests-btn').classList.add('hidden');
            document.getElementById('add-expense-btn').classList.add('hidden');
        }
        showUserAlertIfExists();
    } catch(e) {
        errorBox.textContent = "بيانات الدخول غير صحيحة أو هناك مشكلة: " + e.message;
    }
}

// تسجيل الخروج
function logout() {
    auth.signOut().then(() => {
        currentUser = null;
        currentUserData = null;
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
        document.getElementById('login-email').value = "";
        document.getElementById('login-password').value = "";
    });
}

// نافذة السداد
function showPaymentModal() {
    document.getElementById('payment-amount').value = 50;
    document.getElementById('payment-request-msg').textContent = "";
    document.getElementById('payment-ref').value = "";
    document.getElementById('payment-modal').classList.remove('hidden');
}
function hidePaymentModal() {
    document.getElementById('payment-modal').classList.add('hidden');
}

// نافذة رسالة النجاح
function showSuccessModal(msg) {
    document.getElementById('success-message').textContent = msg;
    document.getElementById('success-modal').classList.remove('hidden');
}
function hideSuccessModal() {
    document.getElementById('success-modal').classList.add('hidden');
}

// نافذة مراجعة الطلبات
function showReviewModal() {
    document.getElementById('review-modal').classList.remove('hidden');
    loadPendingRequests();
}
function hideReviewModal() {
    document.getElementById('review-modal').classList.add('hidden');
}

// نافذة صرف مبلغ
function showExpenseModal() {
    document.getElementById('expense-date').value = new Date().toISOString().slice(0,10);
    document.getElementById('expense-note').value = "";
    document.getElementById('expense-member').value = "";
    document.getElementById('expense-amount').value = "";
    document.getElementById('expense-remarks').value = "";
    document.getElementById('expense-msg').textContent = "";
    document.getElementById('expense-modal').classList.remove('hidden');
}
function hideExpenseModal() {
    document.getElementById('expense-modal').classList.add('hidden');
}

// إضافة طلب سداد جديد
function addPaymentRequest() {
    const selMonth = document.getElementById('payment-month');
    const selMember = document.getElementById('payment-member');
    const month = selMonth.options[selMonth.selectedIndex].text;
    const member = selMember.value;
    const amount = Number(document.getElementById('payment-amount').value);
    const method = document.getElementById('payment-method').value;
    const ref = document.getElementById('payment-ref').value;
    const msgBox = document.getElementById('payment-request-msg');
    if (!currentUser || !amount || !member) {
        msgBox.textContent = "كل الحقول مطلوبة.";
        return;
    }
    msgBox.textContent = "جاري إرسال الطلب...";
    db.collection("payments_requests").add({
        date: new Date().toISOString().slice(0,10),
        note: `سداد ${month}`,
        type: "إيراد",
        member: member,
        amount: amount,
        remarks: "",
        status: "في الانتظار",
        paymentMethod: method,
        paymentRef: ref,
        requestedBy: currentUser.uid
    }).then(() => {
        msgBox.textContent = "";
        hidePaymentModal();
        showSuccessModal("تم إرسال طلب السداد وسيتم مراجعته من أمين الصندوق. شكراً لك.");
    }).catch(e => {
        msgBox.textContent = "حدث خطأ: " + e.message;
    });
}

// إضافة مصروف
function addExpense() {
    const date = document.getElementById('expense-date').value;
    const note = document.getElementById('expense-note').value.trim();
    const member = document.getElementById('expense-member').value.trim();
    const amount = Number(document.getElementById('expense-amount').value);
    const remarks = document.getElementById('expense-remarks').value.trim();
    const msg = document.getElementById('expense-msg');
    if (!date || !note || !amount) {
        msg.textContent = "كل الحقول الأساسية مطلوبة.";
        return;
    }
    db.collection("statement").add({
        date,
        note,
        type: "مصروف",
        member,
        amount,
        remarks
    }).then(() => {
        msg.textContent = "";
        hideExpenseModal();
        showSuccessModal("تم تسجيل المصروف بنجاح.");
    }).catch(e => {
        msg.textContent = "حدث خطأ: " + e.message;
    });
}

// مراجعة الطلبات في الانتظار (أمين الصندوق)
function loadPendingRequests() {
    const listDiv = document.getElementById('pending-requests-list');
    listDiv.innerHTML = "جاري التحميل...";
    db.collection("payments_requests").where('status', '==', 'في الانتظار').get().then(qs => {
        if (qs.empty) {
            listDiv.innerHTML = "<p style='color:#666;font-size:1.1rem;'>لا توجد طلبات في الانتظار.</p>";
            return;
        }
        let html = "<table><thead><tr><th>التاريخ</th><th>العضو</th><th>الشهر</th><th>المبلغ</th><th>طريقة التحويل</th><th>رقم العملية/ملاحظة</th><th>اعتماد</th><th>رفض</th></tr></thead><tbody>";
        qs.forEach(doc => {
            const d = doc.data();
            html += `<tr>
                <td>${d.date}</td>
                <td>${d.member}</td>
                <td>${d.note}</td>
                <td>${d.amount}</td>
                <td>${d.paymentMethod || ""}</td>
                <td>${d.paymentRef || ""}</td>
                <td><button onclick="approveRequest('${doc.id}')">اعتماد</button></td>
                <td><button onclick="rejectRequest('${doc.id}')">رفض</button></td>
            </tr>`;
        });
        html += "</tbody></table>";
        listDiv.innerHTML = html;
    });
}
function approveRequest(id) {
    db.collection("payments_requests").doc(id).get().then(doc => {
        const d = doc.data();
        return db.collection("statement").add({
            date: d.date,
            note: d.note,
            type: d.type,
            member: d.member,
            amount: d.amount,
            remarks: `تم اعتماده من أمين الصندوق (${d.paymentMethod}${d.paymentRef ? " - " + d.paymentRef : ""})`
        }).then(() => {
            return db.collection("payments_requests").doc(id).update({status: "معتمد"});
        });
    }).then(() => {
        loadPendingRequests();
    });
}
function rejectRequest(id) {
    db.collection("payments_requests").doc(id).update({status: "مرفوض"}).then(() => {
        loadPendingRequests();
    });
}

// الاستماع للتغيرات في كشف الحساب (Realtime)
function listenForStatementChanges() {
    db.collection("statement").orderBy("date", "asc")
      .onSnapshot(snapshot => {
        statement = [];
        snapshot.forEach(doc => {
            statement.push(doc.data());
        });
        renderTable();
        updateBalance();
      });
}

// عرض كشف الحساب في الجدول (تمييز المصروفات باللون الأحمر والمبلغ بين قوسين)
function renderTable() {
    const tbody = document.getElementById('statement-table').querySelector("tbody");
    tbody.innerHTML = "";
    statement.forEach(row => {
        const isExpense = row.type === "مصروف";
        const trClass = isExpense ? ' class="expense-row"' : '';
        let amountText = isExpense ? `(${row.amount})` : row.amount;
        tbody.innerHTML += `
            <tr${trClass}>
                <td>${row.date}</td>
                <td>${row.note}</td>
                <td>${row.type}</td>
                <td>${row.member}</td>
                <td class="amount-cell">${amountText}</td>
                <td>${row.remarks || ""}</td>
            </tr>
        `;
    });
}

// تحديث الرصيد
function updateBalance() {
    let total = 0;
    for (const row of statement) {
        if (row.type === "إيراد") total += Number(row.amount);
        else if (row.type === "مصروف") total -= Number(row.amount);
    }
    document.getElementById('current-balance').textContent = total + " ج.م";
}

// فلترة كشف الحساب بالتاريخ
function filterTable() {
    const from = document.getElementById('from-date').value;
    const to = document.getElementById('to-date').value;
    const tbody = document.getElementById('statement-table').querySelector("tbody");
    tbody.innerHTML = "";
    statement.forEach(row => {
        if (
            (!from || row.date >= from) &&
            (!to || row.date <= to)
        ) {
            const isExpense = row.type === "مصروف";
            const trClass = isExpense ? ' class="expense-row"' : '';
            let amountText = isExpense ? `(${row.amount})` : row.amount;
            tbody.innerHTML += `
                <tr${trClass}>
                    <td>${row.date}</td>
                    <td>${row.note}</td>
                    <td>${row.type}</td>
                    <td>${row.member}</td>
                    <td class="amount-cell">${amountText}</td>
                    <td>${row.remarks || ""}</td>
                </tr>
            `;
        }
    });
}

// --- تصدير كشف الحساب إلى Excel (باللغة العربية) ---
function exportToExcel() {
    let excelData = statement.map(row => ({
        "التاريخ": row.date,
        "البيان": row.note,
        "النوع": row.type,
        "العضو": row.member,
        "المبلغ": row.type === "مصروف" ? `(${row.amount})` : row.amount,
        "ملاحظات": row.remarks || ""
    }));

    const from = document.getElementById('from-date').value;
    const to = document.getElementById('to-date').value;
    if (from || to) {
        excelData = excelData.filter(row =>
            (!from || row["التاريخ"] >= from) &&
            (!to || row["التاريخ"] <= to)
        );
    }

    if (excelData.length === 0) {
        alert("لا توجد بيانات لتصديرها.");
        return;
    }

    const ws = XLSX.utils.json_to_sheet(excelData, {header: ["التاريخ", "البيان", "النوع", "العضو", "المبلغ", "ملاحظات"]});
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كشف الحساب");
    XLSX.writeFile(wb, "كشف_حساب_صندوق_تكافل.xlsx");
}

// ====== إشعارات المتأخرين في السداد ======
function sendLateAlert(uid) {
    const now = new Date();
    const monthStr = now.toLocaleString('ar-EG', {month: 'long'}) + " " + now.getFullYear();
    const msg = `أنت متأخر في سداد اشتراك شهر ${monthStr}. يرجى السداد فورًا.`;
    db.collection("users").doc(uid).update({
        alertMessage: msg
    }).then(() => {
        alert("تم إرسال الإشعار.");
    });
}

// عند دخول أي مستخدم، إذا لديه alertMessage تظهر في أعلى الموقع (وتحذف بعد رؤيتها)
function showUserAlertIfExists() {
    if (!currentUser || !currentUserData) return;
    db.collection("users").doc(currentUser.uid).get().then(doc => {
        const d = doc.data();
        if (d && d.alertMessage) {
            showTopAlert(d.alertMessage);
            db.collection("users").doc(currentUser.uid).update({
                alertMessage: firebase.firestore.FieldValue.delete()
            });
        }
    });
}

// إضافة div لعرض الإشعار في أعلى الصفحة
function showTopAlert(msg) {
    let el = document.getElementById('top-alert');
    if (!el) {
        el = document.createElement('div');
        el.id = 'top-alert';
        el.style.background = '#ffecb2';
        el.style.color = '#b20000';
        el.style.fontWeight = 'bold';
        el.style.textAlign = 'center';
        el.style.padding = '1rem';
        el.style.margin = '0';
        el.style.fontSize = '1.2rem';
        document.body.prepend(el);
    }
    el.textContent = msg;
    setTimeout(() => { if (el) el.remove(); }, 8000);
}

window.onload = function() {};
