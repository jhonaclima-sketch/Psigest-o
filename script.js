import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Configuração Firebase (Deve ser preenchida com suas chaves reais para funcionamento)
const firebaseConfig = {
    apiKey: "", // Insira sua API Key aqui
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

// Inicialização Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "psigestao-app-v1";

// Estado Global da Aplicação
let state = {
    user: null,
    patients: [],
    appointments: [],
    currentMonth: new Date()
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    setupEventListeners();
    renderCalendar();
    lucide.createIcons();
});

// Autenticação Silenciosa
async function initAuth() {
    try {
        await signInAnonymously(auth);
        onAuthStateChanged(auth, (user) => {
            if (user) {
                state.user = user;
                subscribeToData();
                showNotification("Sessão iniciada com sucesso", "success");
            }
        });
    } catch (error) {
        console.error("Erro na autenticação:", error);
        showNotification("Erro ao conectar ao servidor", "error");
    }
}

// Escuta de Dados em Tempo Real (Firestore)
function subscribeToData() {
    if (!state.user) return;

    // Escutar Pacientes
    const qPatients = collection(db, 'artifacts', appId, 'users', state.user.uid, 'pacientes');
    onSnapshot(qPatients, (snap) => {
        state.patients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateUI();
    }, (err) => console.error(err));

    // Escutar Agenda
    const qAgenda = collection(db, 'artifacts', appId, 'users', state.user.uid, 'agenda');
    onSnapshot(qAgenda, (snap) => {
        state.appointments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCalendar();
        updateUI();
    }, (err) => console.error(err));
}

// --- EVENTOS E NAVEGAÇÃO ---
function setupEventListeners() {
    // Alternância de Abas
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');
            switchTab(target);
        });
    });

    // Navegação de Calendário
    document.getElementById('prev-month').onclick = () => moveMonth(-1);
    document.getElementById('next-month').onclick = () => moveMonth(1);
    
    // Sidebar Mobile
    document.getElementById('open-sidebar-btn').onclick = toggleSidebar;
    document.getElementById('close-sidebar-btn').onclick = toggleSidebar;
    document.getElementById('sidebar-overlay').onclick = toggleSidebar;

    // Dark Mode
    document.getElementById('theme-toggle').onclick = () => {
        document.documentElement.classList.toggle('dark');
    };
}

function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-tab'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active-tab');

    // Atualizar Header
    const titles = { painel: "Início", agenda: "Agenda Mensal", pacientes: "Pacientes", perfil: "Configurações" };
    document.getElementById('page-title').innerText = titles[tabId];
    
    // Exibir/Esconder controles de calendário
    document.getElementById('calendar-controls').classList.toggle('hidden', tabId !== 'agenda');
    document.getElementById('calendar-controls').classList.toggle('flex', tabId === 'agenda');

    if (window.innerWidth < 1024) toggleSidebar();
}

// --- LÓGICA DA AGENDA MENSAL ---
function moveMonth(dir) {
    state.currentMonth.setMonth(state.currentMonth.getMonth() + dir);
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const display = document.getElementById('month-display');
    if (!grid) return;

    grid.innerHTML = '';
    const date = state.currentMonth;
    const year = date.getFullYear();
    const month = date.getMonth();

    // Nome do mês atual
    display.innerText = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDayDate = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDate = new Date(year, month, 0).getDate();

    // Preencher dias do mês anterior
    for (let i = firstDayIndex; i > 0; i--) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day not-current';
        dayEl.innerHTML = `<span class="text-xs font-bold">${prevMonthLastDate - i + 1}</span>`;
        grid.appendChild(dayEl);
    }

    // Preencher dias do mês atual
    for (let day = 1; day <= lastDayDate; day++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.innerHTML = `<span class="text-xs font-bold">${day}</span>`;
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Consultas do dia
        const dayAppts = state.appointments.filter(a => a.date === dateStr);
        dayAppts.sort((a,b) => a.time.localeCompare(b.time)).forEach(appt => {
            const chip = document.createElement('div');
            chip.className = 'event-chip';
            chip.innerText = `${appt.time} - ${appt.patientName}`;
            dayEl.appendChild(chip);
        });

        grid.appendChild(dayEl);
    }
}

// --- UTILITÁRIOS DE UI ---
function updateUI() {
    // Atualizar Estatísticas do Painel
    document.getElementById('count-patients').innerText = state.patients.length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = state.appointments.filter(a => a.date === todayStr).length;
    document.getElementById('count-today').innerText = todayCount;
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const isOpen = !sidebar.classList.contains('-translate-x-full');

    if (isOpen) {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('opacity-0', 'pointer-events-none');
        overlay.classList.remove('opacity-100', 'pointer-events-auto');
    } else {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('opacity-0', 'pointer-events-none');
        overlay.classList.add('opacity-100', 'pointer-events-auto');
    }
}

function showNotification(msg, type = "success") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgColor = type === "success" ? "bg-teal-600" : "bg-rose-600";
    toast.className = `${bgColor} text-white px-6 py-3 rounded-xl shadow-lg transform transition-all duration-300 scale-90 opacity-0`;
    toast.innerText = msg;
    
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('scale-90', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('scale-90', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
