let lamps = [];
let selectedLamp = null;
let hoveredLamp = null;
let maintenanceHistory = JSON.parse(localStorage.getItem('maintenanceHistory')) || {};

// Şifre yönetimi
let correctPassword = localStorage.getItem('lampMapPassword') || "1234"; // Varsayılan şifre: 1234
localStorage.setItem('lampMapPassword', correctPassword); // İlk şifreyi kaydet

// Yanlış şifre deneme sınırı
let loginAttempts = 0;
const maxAttempts = 3;
let isLocked = false;

// Carousel Logic and Warranty Map
let currentSlide = 0;
let slides = null;
let isCarouselInitialized = false;

// Depodaki parçaların stok miktarını tutan veri yapısı
let stockInventory = JSON.parse(localStorage.getItem('stockInventory')) || {
    "LED": 10, // Varsayılan stok miktarları
    "Driver": 8,
    "Complete Lamp Equipment": 5
};

// Stok bilgisini localStorage'a kaydetmek için bir yardımcı fonksiyon
function saveStockInventory() {
    localStorage.setItem('stockInventory', JSON.stringify(stockInventory));
}

// Levenshtein Distance for fuzzy search
function levenshteinDistance(a, b) {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + indicator
            );
        }
    }
    return matrix[b.length][a.length];
}

// Password checking logic
function checkPassword() {
    if (isLocked) {
        document.getElementById('attempts-message').style.display = 'block';
        return;
    }

    const enteredCode = document.getElementById('access-code').value;
    const errorMessage = document.getElementById('error-message');

    if (enteredCode === correctPassword) {
        document.getElementById('password-screen').style.display = 'none';
        document.getElementById('lamp-map-content').style.display = 'block';
        document.getElementById('change-password-screen').style.display = 'none';
        loginAttempts = 0;
        errorMessage.style.display = 'none';
        initializeCarousel();
    } else {
        loginAttempts++;
        errorMessage.style.display = 'block';
        document.getElementById('access-code').value = '';
        if (loginAttempts >= maxAttempts) {
            isLocked = true;
            document.getElementById('attempts-message').style.display = 'block';
            document.getElementById('access-code').disabled = true;
            setTimeout(() => {
                isLocked = false;
                loginAttempts = 0;
                document.getElementById('attempts-message').style.display = 'none';
                document.getElementById('access-code').disabled = false;
                errorMessage.style.display = 'none';
            }, 60000);
        }
    }
}

// Password change screen logic
function showChangePasswordScreen() {
    document.getElementById('password-screen').style.display = 'none';
    document.getElementById('change-password-screen').style.display = 'flex';
}

function cancelChangePassword() {
    document.getElementById('change-password-screen').style.display = 'none';
    document.getElementById('password-screen').style.display = 'flex';
    document.getElementById('old-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('change-error-message').style.display = 'none';
}

function changePassword() {
    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;
    const errorMessage = document.getElementById('change-error-message');

    if (oldPassword !== correctPassword) {
        errorMessage.textContent = 'Incorrect old password.';
        errorMessage.style.display = 'block';
        return;
    }

    if (!/^\d{4}$/.test(newPassword)) {
        errorMessage.textContent = 'New password must be a 4-digit number.';
        errorMessage.style.display = 'block';
        return;
    }

    correctPassword = newPassword;
    localStorage.setItem('lampMapPassword', correctPassword);
    alert('Password updated successfully!');
    cancelChangePassword();
}

// Save a maintenance record
function saveMaintenance() {
    if (!selectedLamp) return;

    const type = document.getElementById('maintenance-type').value;
    const part = document.getElementById('maintenance-part').value;
    const day = document.getElementById('maintenance-day').value;
    const month = document.getElementById('maintenance-month').value;
    const year = document.getElementById('maintenance-year').value;
    const comments = document.getElementById('maintenance-comments').value;

    let record = `${type} on: ${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    record += `, Part: ${part}`;
    if (comments) {
        record += `, Comments: ${comments}`;
    }

    // Stok kontrolü ve güncelleme
    if (type === 'Changed' && part !== 'None') {
        if (stockInventory[part] > 0) {
            stockInventory[part] -= 1;
            saveStockInventory();

            const manufacturer = document.getElementById('manufacturer').value;
            const warrantyType = document.getElementById('warranty-type').value;
            const purchaseDay = document.getElementById('purchase-day').value;
            const purchaseMonth = document.getElementById('purchase-month').value;
            const purchaseYear = document.getElementById('purchase-year').value;

            record += `, Manufacturer: ${manufacturer || 'Not specified'}`;
            record += `, Purchase Date: ${purchaseYear}-${purchaseMonth.padStart(2, '0')}-${purchaseDay.padStart(2, '0')}`;

            if (warrantyType === 'duration') {
                const warrantyYears = document.getElementById('warranty-years').value;
                record += `, Warranty: ${warrantyYears || '0'} years`;
            } else {
                const warrantyEndDay = document.getElementById('warranty-end-day').value;
                const warrantyEndMonth = document.getElementById('warranty-end-month').value;
                const warrantyEndYear = document.getElementById('warranty-end-year').value;
                record += `, Warranty Ends: ${warrantyEndYear}-${warrantyEndMonth.padStart(2, '0')}-${warrantyEndDay.padStart(2, '0')}`;
            }
        } else {
            alert('Stokta yeterli parça yok! Lütfen depoyu kontrol edin.');
            return;
        }
    }

    // Add a timestamp to the record
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0] + ' ' + now.toTimeString().split(' ')[0];
    record += `, Last Updated: ${timestamp}`;

    if (!maintenanceHistory[selectedLamp]) {
        maintenanceHistory[selectedLamp] = [];
    }
    maintenanceHistory[selectedLamp].push(record);
    
    localStorage.setItem('maintenanceHistory', JSON.stringify(maintenanceHistory));
    
    showHistory(selectedLamp);
    
    document.getElementById('maintenance-input').style.display = 'none';
}

// Delete a maintenance record
function deleteMaintenanceRecord(lampId, index) {
    if (maintenanceHistory[lampId] && index >= 0 && index < maintenanceHistory[lampId].length) {
        if (confirm('Are you sure you want to delete this maintenance record?')) {
            maintenanceHistory[lampId].splice(index, 1);
            localStorage.setItem('maintenanceHistory', JSON.stringify(maintenanceHistory));
            showHistory(lampId);
        }
    }
}

// Show maintenance history for a lamp
function showHistory(lampId) {
    const historyList = document.getElementById('history-list');
    const historyLamp = document.getElementById('history-lamp');
    historyLamp.textContent = lampId;
    historyList.innerHTML = '';

    const history = maintenanceHistory[lampId] || [];
    if (history.length === 0) {
        historyList.innerHTML = '<tr><td colspan="2">No maintenance records available.</td></tr>';
    } else {
        history.forEach((record, index) => {
            let tr = document.createElement('tr');
            
            let recordCell = document.createElement('td');
            recordCell.textContent = record;
            
            let actionCell = document.createElement('td');
            let deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.onclick = () => deleteMaintenanceRecord(lampId, index);
            
            actionCell.appendChild(deleteButton);
            tr.appendChild(recordCell);
            tr.appendChild(actionCell);
            historyList.appendChild(tr);
        });
    }
}

// Show all lamp histories
function showAllHistories() {
    const allHistoriesDiv = document.getElementById('all-histories');
    const allHistoriesList = document.getElementById('all-histories-list');
    const showAllButton = document.getElementById('show-all-button');

    if (allHistoriesDiv.style.display === 'block') {
        allHistoriesDiv.style.display = 'none';
        showAllButton.textContent = 'Show All Lamp Histories';
        return;
    }

    // Populate filter years
    populateFilterYears();

    // Display all histories (will be filtered later)
    allHistoriesList.innerHTML = '';

    let hasRecords = false;
    lamps.forEach(lamp => {
        const history = maintenanceHistory[lamp.id] || [];
        history.forEach(record => {
            hasRecords = true;
            let tr = document.createElement('tr');
            
            let lampIdCell = document.createElement('td');
            lampIdCell.textContent = lamp.id;
            
            let recordCell = document.createElement('td');
            recordCell.textContent = record;
            
            tr.appendChild(lampIdCell);
            tr.appendChild(recordCell);
            allHistoriesList.appendChild(tr);
        });
    });

    if (!hasRecords) {
        allHistoriesList.innerHTML = '<tr><td colspan="2">No maintenance records available for any lamp.</td></tr>';
    }

    allHistoriesDiv.style.display = 'block';
    showAllButton.textContent = 'Hide All Lamp Histories';
    allHistoriesDiv.scrollIntoView({ behavior: 'smooth' });
}

// Populate year filter dropdown
function populateFilterYears() {
    const yearSelect = document.getElementById('filter-year');
    // Clear existing options except the "All Years" option
    while (yearSelect.options.length > 1) {
        yearSelect.remove(1);
    }

    // Collect all unique years from records
    const years = new Set();
    lamps.forEach(lamp => {
        const history = maintenanceHistory[lamp.id] || [];
        history.forEach(record => {
            const match = record.match(/\d{4}-\d{2}-\d{2}/);
            if (match) {
                const year = match[0].split('-')[0];
                years.add(year);
            }
        });
    });

    // Add years to the dropdown
    Array.from(years).sort().forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.text = year;
        yearSelect.appendChild(option);
    });
}

// Filter maintenance histories
function filterHistories() {
    const filterType = document.getElementById('filter-type').value;
    const filterYear = document.getElementById('filter-year').value;
    const searchTerm = document.getElementById('history-search').value.trim().toLowerCase();
    const allHistoriesList = document.getElementById('all-histories-list');

    allHistoriesList.innerHTML = '';

    let hasRecords = false;
    lamps.forEach(lamp => {
        const history = maintenanceHistory[lamp.id] || [];
        history.forEach(record => {
            // Apply type filter
            let matchesType = filterType === 'all' || record.startsWith(filterType);

            // Apply year filter
            let matchesYear = true;
            if (filterYear !== 'all') {
                const match = record.match(/\d{4}-\d{2}-\d{2}/);
                if (match) {
                    const year = match[0].split('-')[0];
                    matchesYear = year === filterYear;
                } else {
                    matchesYear = false;
                }
            }

            // Apply search filter
            let matchesSearch = true;
            if (searchTerm) {
                const lampIdStr = lamp.id.toString();
                const recordLower = record.toLowerCase();
                const distanceToId = levenshteinDistance(searchTerm, lampIdStr);
                const distanceToRecord = levenshteinDistance(searchTerm, recordLower);
                matchesSearch = recordLower.includes(searchTerm) || lampIdStr.includes(searchTerm) || distanceToId < 3 || distanceToRecord < 5;
            }

            // Display record if it matches all filters
            if (matchesType && matchesYear && matchesSearch) {
                hasRecords = true;
                let tr = document.createElement('tr');
                
                let lampIdCell = document.createElement('td');
                lampIdCell.textContent = lamp.id;
                
                let recordCell = document.createElement('td');
                recordCell.textContent = record;
                
                tr.appendChild(lampIdCell);
                tr.appendChild(recordCell);
                allHistoriesList.appendChild(tr);
            }
        });
    });

    if (!hasRecords) {
        allHistoriesList.innerHTML = '<tr><td colspan="2">No matching records found.</td></tr>';
    }
}

// Reset history filters
function resetFilters() {
    document.getElementById('filter-type').value = 'all';
    document.getElementById('filter-year').value = 'all';
    document.getElementById('history-search').value = '';
    filterHistories();
}

// Export maintenance history as a CSV file
function exportToCSV() {
    let csvContent = "Lamp ID,Record\n"; // CSV header

    lamps.forEach(lamp => {
        const history = maintenanceHistory[lamp.id] || [];
        history.forEach(record => {
            const escapedRecord = `"${record.replace(/"/g, '""')}"`;
            csvContent += `${lamp.id},${escapedRecord}\n`;
        });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'lamp_maintenance_history.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

// Carousel navigation functions
function initializeCarousel() {
    if (isCarouselInitialized) return;
    slides = document.getElementsByClassName('carousel-slide');
    goToSlide(0);
    isCarouselInitialized = true;
}

function goToSlide(index) {
    if (!slides || slides.length === 0) return;
    
    // Show loading spinner
    const loadingSpinner = document.getElementById('carousel-loading');
    loadingSpinner.style.display = 'block';
    
    currentSlide = index;
    if (currentSlide < 0) currentSlide = slides.length - 1;
    if (currentSlide >= slides.length) currentSlide = 0;
    const offset = -currentSlide * 100;
    document.getElementById('carousel').style.transform = `translateX(${offset}%)`;
    updateDots();
    updateCanvasVisibility();
    
    // Hide loading spinner after transition
    setTimeout(() => {
        loadingSpinner.style.display = 'none';
    }, 500);
}

function nextSlide() {
    goToSlide(currentSlide + 1);
}

function prevSlide() {
    goToSlide(currentSlide - 1);
}

function updateDots() {
    const dots = document.getElementsByClassName('carousel-dot');
    for (let i = 0; i < dots.length; i++) {
        dots[i].classList.toggle('active', i === currentSlide);
    }
}

function updateCanvasVisibility() {
    const maintenanceCanvasEl = document.getElementById('map-canvas');
    const warrantyCanvasEl = document.getElementById('map-canvas-warranty');
    
    if (!maintenanceCanvasEl || !warrantyCanvasEl) {
        console.error('Canvas container not found:', { maintenanceCanvasEl, warrantyCanvasEl });
        return;
    }
    
    if (currentSlide === 0) {
        maintenanceCanvasEl.style.display = 'block';
        warrantyCanvasEl.style.display = 'none';
    } else {
        maintenanceCanvasEl.style.display = 'none';
        warrantyCanvasEl.style.display = 'block';
    }
}

// Toggle replacement details visibility and stock info
function toggleReplacementDetails() {
    const partSelect = document.getElementById('maintenance-part');
    const typeSelect = document.getElementById('maintenance-type');
    const replacementDetails = document.getElementById('replacement-details');
    const stockInfo = document.getElementById('stock-info');
    const stockQuantity = document.getElementById('stock-quantity');
    const stockProgress = document.getElementById('stock-progress');
    const stockWarning = document.getElementById('stock-warning');

    if (typeSelect.value === 'Changed' && partSelect.value !== 'None') {
        replacementDetails.style.display = 'block';
        stockInfo.style.display = 'block';

        const selectedPart = partSelect.value;
        const quantity = stockInventory[selectedPart] || 0;
        stockQuantity.textContent = `${quantity} available`;

        const maxStock = 10;
        const percentage = (quantity / maxStock) * 100;
        stockProgress.style.width = `${percentage}%`;

        stockProgress.classList.remove('low', 'depleted');
        stockWarning.style.display = 'none';
        if (quantity === 0) {
            stockProgress.classList.add('depleted');
            stockWarning.textContent = 'Stock Tükenmek Üzere! Lütfen depoyu kontrol edin.';
            stockWarning.style.display = 'block';
        } else if (quantity <= 5) {
            stockProgress.classList.add('low');
            stockWarning.textContent = 'Düşük Stok: Yakında tükenmek üzere!';
            stockWarning.style.display = 'block';
        }
    } else {
        replacementDetails.style.display = 'none';
        stockInfo.style.display = 'none';
    }
}

// Toggle warranty fields in the form
function toggleWarrantyFields() {
    const warrantyType = document.getElementById('warranty-type').value;
    const warrantyDuration = document.getElementById('warranty-duration');
    const warrantyEndDate = document.getElementById('warranty-end-date');
    if (warrantyType === 'duration') {
        warrantyDuration.style.display = 'block';
        warrantyEndDate.style.display = 'none';
    } else {
        warrantyDuration.style.display = 'none';
        warrantyEndDate.style.display = 'block';
    }
}

// Reset the maintenance form
function resetMaintenanceForm() {
    document.getElementById('maintenance-type').value = 'Repaired';
    document.getElementById('maintenance-part').value = 'None';
    document.getElementById('maintenance-day').selectedIndex = 0;
    document.getElementById('maintenance-month').selectedIndex = 0;
    document.getElementById('maintenance-year').selectedIndex = 0;
    document.getElementById('maintenance-comments').value = '';
    document.getElementById('manufacturer').value = '';
    document.getElementById('warranty-type').value = 'duration';
    document.getElementById('warranty-years').value = '';
    document.getElementById('warranty-end-day').selectedIndex = 0;
    document.getElementById('warranty-end-month').selectedIndex = 0;
    document.getElementById('warranty-end-year').selectedIndex = 0;
    document.getElementById('purchase-day').selectedIndex = 0;
    document.getElementById('purchase-month').selectedIndex = 0;
    document.getElementById('purchase-year').selectedIndex = 0;
    
    document.getElementById('replacement-details').style.display = 'none';
    document.getElementById('warranty-duration').style.display = 'block';
    document.getElementById('warranty-end-date').style.display = 'none';
}

// Get lamp color based on maintenance history
function getLampColor(lampId) {
    const history = maintenanceHistory[lampId] || [];
    if (history.length === 0) {
        return { r: 128, g: 128, b: 128 }; // Gray (no maintenance)
    }

    const latestRecord = history[history.length - 1];
    const dateStr = latestRecord.match(/\d{4}-\d{2}-\d{2}/)[0];
    const maintenanceDate = new Date(dateStr);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate - maintenanceDate);
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365);

    if (diffYears > 5) {
        return { r: 255, g: 0, b: 0 }; // Red (5+ years)
    } else if (diffYears <= 2) {
        return { r: 0, g: 255, b: 0 }; // Green (within 2 years)
    } else {
        return { r: 255, g: 255, b: 0 }; // Yellow (2-5 years)
    }
}

// Get warranty color based on warranty status
function getWarrantyColor(lampId) {
    const history = maintenanceHistory[lampId] || [];
    const currentDate = new Date('2025-05-02'); // Using the current date from your context
    let warrantyEndDate = null;
    let purchaseDate = null;

    for (let record of history) {
        if (record.includes('Changed') && (record.includes('Warranty:') || record.includes('Warranty Ends:'))) {
            const match = record.match(/Purchase Date: (\d{4}-\d{2}-\d{2})/);
            if (match) purchaseDate = new Date(match[1]);
            if (record.includes('Warranty:')) {
                const years = parseInt(record.match(/Warranty: (\d+)/)[1]);
                warrantyEndDate = new Date(purchaseDate);
                warrantyEndDate.setFullYear(warrantyEndDate.getFullYear() + years);
            } else if (record.includes('Warranty Ends:')) {
                const endMatch = record.match(/Warranty Ends: (\d{4}-\d{2}-\d{2})/);
                if (endMatch) warrantyEndDate = new Date(endMatch[1]);
            }
        }
    }

    if (!warrantyEndDate || !purchaseDate) {
        return { r: 255, g: 255, b: 255 }; // White (no warranty info)
    }

    if (warrantyEndDate > currentDate) {
        return { r: 0, g: 255, b: 0 }; // Green (active warranty)
    } else {
        return { r: 255, g: 0, b: 0 }; // Red (expired warranty)
    }
}

// Get warranty information for a lamp
function getWarrantyInfo(lampId) {
    const history = maintenanceHistory[lampId] || [];
    const currentDate = new Date('2025-05-02');
    let warrantyInfo = { manufacturer: 'Not specified', purchaseDate: 'Not specified', status: 'No warranty info', details: '', tooltip: 'No warranty info' };
    let warrantyEndDate = null;
    let purchaseDate = null;

    for (let record of history) {
        if (record.includes('Changed') && (record.includes('Manufacturer:') || record.includes('Purchase Date:'))) {
            const manufacturerMatch = record.match(/Manufacturer: ([\w\s]+)/);
            if (manufacturerMatch) warrantyInfo.manufacturer = manufacturerMatch[1];
            const purchaseMatch = record.match(/Purchase Date: (\d{4}-\d{2}-\d{2})/);
            if (purchaseMatch) {
                purchaseDate = new Date(purchaseMatch[1]);
                warrantyInfo.purchaseDate = purchaseMatch[1];
            }
            if (record.includes('Warranty:')) {
                const years = parseInt(record.match(/Warranty: (\d+)/)[1]);
                warrantyEndDate = new Date(purchaseDate);
                warrantyEndDate.setFullYear(warrantyEndDate.getFullYear() + years);
                warrantyInfo.details = `Duration: ${years} years`;
            } else if (record.includes('Warranty Ends:')) {
                const endMatch = record.match(/Warranty Ends: (\d{4}-\d{2}-\d{2})/);
                if (endMatch) {
                    warrantyEndDate = new Date(endMatch[1]);
                    warrantyInfo.details = `Ends: ${endMatch[1]}`;
                }
            }
        }
    }

    if (warrantyEndDate && purchaseDate) {
        warrantyInfo.status = warrantyEndDate > currentDate ? 'Warranty Active' : 'Warranty Expired';
        warrantyInfo.tooltip = warrantyEndDate > currentDate ? `Warranty Active until ${warrantyInfo.details.split(': ')[1]}` : `Warranty Expired on ${warrantyInfo.details.split(': ')[1]}`;
    }
    return warrantyInfo;
}

// Show warranty details for a lamp
function showWarrantyDetails(lampId) {
    const info = getWarrantyInfo(lampId);
    document.getElementById('warranty-manufacturer').textContent = `Manufacturer: ${info.manufacturer}`;
    document.getElementById('warranty-purchase-date').textContent = `Purchase Date: ${info.purchaseDate}`;
    document.getElementById('warranty-status').textContent = `Warranty Status: ${info.status}`;
    document.getElementById('warranty-info').textContent = info.details ? `Warranty ${info.details}` : '';
}

// p5.js Sketch for the Maintenance Map
const maintenanceSketch = (p) => {
    const xOffset = 250;
    let scaleFactor = 1;

    p.setup = function() {
        const canvasWidth = window.innerWidth < 600 ? window.innerWidth - 40 : 600;
        const canvasHeight = window.innerWidth < 600 ? (canvasWidth * 2) / 3 : 400;
        scaleFactor = canvasWidth / 600;
        let canvas = p.createCanvas(canvasWidth, canvasHeight);
        canvas.parent('map-canvas');
        p.populateDropdowns();
        p.setupLamps();
    };

    p.setupLamps = function() {
        const lampWidth = 40 * scaleFactor;
        const lampHeight = 20 * scaleFactor;
        lamps = [
            { id: 1, x: (150 + xOffset) * scaleFactor, y: 100 * scaleFactor, width: lampWidth, height: lampHeight },
            { id: 2, x: (150 + xOffset) * scaleFactor, y: 160 * scaleFactor, width: lampWidth, height: lampHeight },
            { id: 3, x: (150 + xOffset) * scaleFactor, y: 220 * scaleFactor, width: lampWidth, height: lampHeight },
            { id: 4, x: (250 + xOffset) * scaleFactor, y: 100 * scaleFactor, width: lampWidth, height: lampHeight },
            { id: 5, x: (250 + xOffset) * scaleFactor, y: 160 * scaleFactor, width: lampWidth, height: lampHeight },
            { id: 6, x: (250 + xOffset) * scaleFactor, y: 220 * scaleFactor, width: lampWidth, height: lampHeight },
            { id: 7, x: (350 + xOffset) * scaleFactor, y: 100 * scaleFactor, width: lampWidth, height: lampHeight },
            { id: 8, x: (350 + xOffset) * scaleFactor, y: 160 * scaleFactor, width: lampWidth, height: lampHeight },
            { id: 9, x: (350 + xOffset) * scaleFactor, y: 220 * scaleFactor, width: lampWidth, height: lampHeight },
            { id: 10, x: (450 + xOffset) * scaleFactor, y: 100 * scaleFactor, width: lampWidth, height: lampHeight },
            { id: 11, x: (450 + xOffset) * scaleFactor, y: 160 * scaleFactor, width: lampWidth, height: lampHeight },
            { id: 12, x: (450 + xOffset) * scaleFactor, y: 220 * scaleFactor, width: lampWidth, height: lampHeight }
        ];
    };

    p.populateDropdowns = function() {
        const daySelect = document.getElementById('maintenance-day');
        const monthSelect = document.getElementById('maintenance-month');
        const yearSelect = document.getElementById('maintenance-year');
        const purchaseDaySelect = document.getElementById('purchase-day');
        const purchaseMonthSelect = document.getElementById('purchase-month');
        const purchaseYearSelect = document.getElementById('purchase-year');
        const warrantyEndDaySelect = document.getElementById('warranty-end-day');
        const warrantyEndMonthSelect = document.getElementById('warranty-end-month');
        const warrantyEndYearSelect = document.getElementById('warranty-end-year');

        const populateDays = (select) => {
            for (let i = 1; i <= 31; i++) {
                let option = document.createElement('option');
                option.value = i;
                option.text = i;
                select.appendChild(option);
            }
        };
        populateDays(daySelect);
        populateDays(purchaseDaySelect);
        populateDays(warrantyEndDaySelect);

        const populateMonths = (select) => {
            for (let i = 1; i <= 12; i++) {
                let option = document.createElement('option');
                option.value = i;
                option.text = i;
                select.appendChild(option);
            }
        };
        populateMonths(monthSelect);
        populateMonths(purchaseMonthSelect);
        populateMonths(warrantyEndMonthSelect);

        const populateYears = (select, startYear, endYear) => {
            for (let i = endYear; i >= startYear; i--) {
                let option = document.createElement('option');
                option.value = i;
                option.text = i;
                select.appendChild(option);
            }
        };
        populateYears(yearSelect, 2000, 2025);
        populateYears(purchaseYearSelect, 2000, 2025);
        populateYears(warrantyEndYearSelect, 2025, 2035);
    };

    p.draw = function() {
        p.clear();
        p.background(255);
        p.drawingContext.shadowBlur = 10;
        p.drawingContext.shadowColor = "rgba(0, 0, 0, 0.2)";
        p.stroke(0);
        p.strokeWeight(2);
        p.fill(200, 200, 200);
        p.rect((50 + xOffset) * scaleFactor, 50 * scaleFactor, 500 * scaleFactor, 300 * scaleFactor, 10);
        p.drawingContext.shadowBlur = 0;

        p.fill(255);
        p.rect((150 + xOffset) * scaleFactor, 50 * scaleFactor, 300 * scaleFactor, 30 * scaleFactor);
        p.fill(0);
        p.textFont('Poppins');
        p.textSize(Math.max(16 * scaleFactor, 12));
        p.stroke(255);
        p.strokeWeight(2);
        p.textAlign(p.CENTER, p.CENTER);
        p.text("Whiteboard", (300 + xOffset) * scaleFactor, (65) * scaleFactor);
        p.noStroke();

        p.fill(255, 165, 0);
        p.rect((470 + xOffset) * scaleFactor, 300 * scaleFactor, 30 * scaleFactor, 50 * scaleFactor);
        p.fill(0);
        p.textFont('Poppins');
        p.textSize(Math.max(14 * scaleFactor, 10));
        p.stroke(255);
        p.strokeWeight(2);
        p.text("Door", (485 + xOffset) * scaleFactor, (325) * scaleFactor);
        p.noStroke();

        lamps.forEach(lamp => {
            let lampColor = getLampColor(lamp.id);
            if (hoveredLamp === lamp.id) {
                p.drawingContext.shadowBlur = 5;
                p.drawingContext.shadowColor = "rgba(0, 0, 0, 0.3)";
                p.fill(255, 0, 0);
                p.stroke(0);
                p.strokeWeight(3);
            } else {
                p.drawingContext.shadowBlur = 3;
                p.drawingContext.shadowColor = "rgba(0, 0, 0, 0.2)";
                p.fill(lampColor.r, lampColor.g, lampColor.b);
                p.stroke(0);
                p.strokeWeight(1);
            }
            p.rect(lamp.x, lamp.y, lamp.width, lamp.height, 5 * scaleFactor);
            p.drawingContext.shadowBlur = 0;

            p.fill(0);
            p.textFont('Poppins');
            p.textSize(Math.max(12 * scaleFactor, 8));
            p.stroke(255);
            p.strokeWeight(1);
            p.textAlign(p.CENTER, p.CENTER);
            p.text(lamp.id, lamp.x + lamp.width / 2, lamp.y + lamp.height / 2);
            p.noStroke();
        });
    };

    p.mousePressed = function() {
        for (let lamp of lamps) {
            if (p.mouseX > lamp.x && p.mouseX < lamp.x + lamp.width &&
                p.mouseY > lamp.y && p.mouseY < lamp.y + lamp.height) {
                selectedLamp = lamp.id;
                document.getElementById('maintenance-input').style.display = 'block';
                document.getElementById('selected-lamp').textContent = lamp.id;
                showHistory(lamp.id);
                break;
            }
        }
    };

    p.mouseMoved = function() {
        const tooltip = document.getElementById('lamp-tooltip');
        hoveredLamp = null;

        for (let lamp of lamps) {
            if (p.mouseX > lamp.x && p.mouseX < lamp.x + lamp.width &&
                p.mouseY > lamp.y && p.mouseY < lamp.y + lamp.height) {
                hoveredLamp = lamp.id;
                const history = maintenanceHistory[lamp.id] || [];
                const latestRecord = history.length > 0 ? history[history.length - 1] : "No maintenance recorded";
                tooltip.textContent = `Lamp ${lamp.id}: ${latestRecord}`;
                tooltip.style.display = 'block';
                tooltip.style.left = (p.mouseX + 10) + 'px';
                tooltip.style.top = (p.mouseY - 30) + 'px';
                break;
            }
        }

        if (!hoveredLamp) {
            tooltip.style.display = 'none';
        }
    };
};

// p5.js Sketch for the Warranty Map
const warrantySketch = (p) => {
    const xOffset = 250;
    let scaleFactor = 1;

    p.setup = function() {
        const canvasWidth = window.innerWidth < 600 ? window.innerWidth - 40 : 600;
        const canvasHeight = window.innerWidth < 600 ? (canvasWidth * 2) / 3 : 400;
        scaleFactor = canvasWidth / 600;
        let canvas = p.createCanvas(canvasWidth, canvasHeight);
        canvas.parent('map-canvas-warranty');
    };

    p.draw = function() {
        p.clear();
        p.background(255);
        p.drawingContext.shadowBlur = 10;
        p.drawingContext.shadowColor = "rgba(0, 0, 0, 0.2)";
        p.stroke(0);
        p.strokeWeight(2);
        p.fill(200, 200, 200);
        p.rect((50 + xOffset) * scaleFactor, 50 * scaleFactor, 500 * scaleFactor, 300 * scaleFactor, 10);
        p.drawingContext.shadowBlur = 0;

        p.fill(255);
        p.rect((150 + xOffset) * scaleFactor, 50 * scaleFactor, 300 * scaleFactor, 30 * scaleFactor);
        p.fill(0);
        p.textFont('Poppins');
        p.textSize(Math.max(16 * scaleFactor, 12));
        p.stroke(255);
        p.strokeWeight(2);
        p.textAlign(p.CENTER, p.CENTER);
        p.text("Whiteboard", (300 + xOffset) * scaleFactor, (65) * scaleFactor);
        p.noStroke();

        p.fill(255, 165, 0);
        p.rect((470 + xOffset) * scaleFactor, 300 * scaleFactor, 30 * scaleFactor, 50 * scaleFactor);
        p.fill(0);
        p.textFont('Poppins');
        p.textSize(Math.max(14 * scaleFactor, 10));
        p.stroke(255);
        p.strokeWeight(2);
        p.text("Door", (485 + xOffset) * scaleFactor, (325) * scaleFactor);
        p.noStroke();

        lamps.forEach(lamp => {
            let lampColor = getWarrantyColor(lamp.id);
            if (hoveredLamp === lamp.id) {
                p.drawingContext.shadowBlur = 5;
                p.drawingContext.shadowColor = "rgba(0, 0, 0, 0.3)";
                p.fill(lampColor.r > 200 ? 150 : lampColor.r, lampColor.g > 200 ? 150 : lampColor.g, lampColor.b > 200 ? 150 : lampColor.b);
                p.stroke(0);
                p.strokeWeight(3);
            } else {
                p.drawingContext.shadowBlur = 3;
                p.drawingContext.shadowColor = "rgba(0, 0, 0, 0.2)";
                p.fill(lampColor.r, lampColor.g, lampColor.b);
                p.stroke(0);
                p.strokeWeight(1);
            }
            p.rect(lamp.x, lamp.y, lamp.width, lamp.height, 5 * scaleFactor);
            p.drawingContext.shadowBlur = 0;

            p.fill(0);
            p.textFont('Poppins');
            p.textSize(Math.max(12 * scaleFactor, 8));
            p.stroke(255);
            p.strokeWeight(1);
            p.textAlign(p.CENTER, p.CENTER);
            p.text(lamp.id, lamp.x + lamp.width / 2, lamp.y + lamp.height / 2);
            p.noStroke();
        });
    };

    p.mousePressed = function() {
        for (let lamp of lamps) {
            if (p.mouseX > lamp.x && p.mouseX < lamp.x + lamp.width &&
                p.mouseY > lamp.y && p.mouseY < lamp.y + lamp.height) {
                selectedLamp = lamp.id;
                document.getElementById('warranty-details').style.display = 'block';
                document.getElementById('selected-lamp-warranty').textContent = lamp.id;
                showWarrantyDetails(lamp.id);
                break;
            }
        }
    };

    p.mouseMoved = function() {
        const tooltip = document.getElementById('lamp-tooltip-warranty');
        hoveredLamp = null;

        for (let lamp of lamps) {
            if (p.mouseX > lamp.x && p.mouseX < lamp.x + lamp.width &&
                p.mouseY > lamp.y && p.mouseY < lamp.y + lamp.height) {
                hoveredLamp = lamp.id;
                const warrantyInfo = getWarrantyInfo(lamp.id);
                tooltip.textContent = `Lamp ${lamp.id}: ${warrantyInfo.tooltip}`;
                tooltip.style.display = 'block';
                tooltip.style.left = (p.mouseX + 10) + 'px';
                tooltip.style.top = (p.mouseY - 30) + 'px';
                break;
            }
        }

        if (!hoveredLamp) {
            tooltip.style.display = 'none';
        }
    };
};

// Initialize the sketches
new p5(maintenanceSketch);
new p5(warrantySketch);