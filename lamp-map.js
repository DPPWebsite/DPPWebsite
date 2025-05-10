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
let maintenanceCanvas, warrantyCanvas;
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

    // Eski şifreyi kontrol et
    if (oldPassword !== correctPassword) {
        errorMessage.textContent = 'Incorrect old password.';
        errorMessage.style.display = 'block';
        return;
    }

    // Yeni şifrenin 4 haneli bir sayı olduğunu kontrol et
    if (!/^\d{4}$/.test(newPassword)) {
        errorMessage.textContent = 'New password must be a 4-digit number.';
        errorMessage.style.display = 'block';
        return;
    }

    // Şifreyi güncelle
    correctPassword = newPassword;
    localStorage.setItem('lampMapPassword', correctPassword);
    alert('Password updated successfully!');
    cancelChangePassword();
}

// Initialize lamps (4 columns, 3 lamps per column)
function setupLamps() {
    const lampWidth = 40;  // Dikdörtgen genişlik
    const lampHeight = 20;  // Dikdörtgen yükseklik
    lamps = [
        // 1. sütun
        { id: 1, x: 150, y: 100, width: lampWidth, height: lampHeight },
        { id: 2, x: 150, y: 160, width: lampWidth, height: lampHeight },
        { id: 3, x: 150, y: 220, width: lampWidth, height: lampHeight },
        // 2. sütun
        { id: 4, x: 250, y: 100, width: lampWidth, height: lampHeight },
        { id: 5, x: 250, y: 160, width: lampWidth, height: lampHeight },
        { id: 6, x: 250, y: 220, width: lampWidth, height: lampHeight },
        // 3. sütun
        { id: 7, x: 350, y: 100, width: lampWidth, height: lampHeight },
        { id: 8, x: 350, y: 160, width: lampWidth, height: lampHeight },
        { id: 9, x: 350, y: 220, width: lampWidth, height: lampHeight },
        // 4. sütun
        { id: 10, x: 450, y: 100, width: lampWidth, height: lampHeight },
        { id: 11, x: 450, y: 160, width: lampWidth, height: lampHeight },
        { id: 12, x: 450, y: 220, width: lampWidth, height: lampHeight }
    ];
}

function populateDropdowns() {
    const daySelect = document.getElementById('maintenance-day');
    const monthSelect = document.getElementById('maintenance-month');
    const yearSelect = document.getElementById('maintenance-year');
    const purchaseDaySelect = document.getElementById('purchase-day');
    const purchaseMonthSelect = document.getElementById('purchase-month');
    const purchaseYearSelect = document.getElementById('purchase-year');
    const warrantyEndDaySelect = document.getElementById('warranty-end-day');
    const warrantyEndMonthSelect = document.getElementById('warranty-end-month');
    const warrantyEndYearSelect = document.getElementById('warranty-end-year');

    // Populate days (1-31)
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

    // Populate months (1-12)
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

    // Populate years (2000 to 2025)
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
    populateYears(warrantyEndYearSelect, 2025, 2035); // Warranty end date can be in the future
}   
    function saveMaintenance() {
        console.log('saveMaintenance started');
    
        if (!selectedLamp) {
            console.log('selectedLamp is null');
            return;
        }
    
        const type = document.getElementById('maintenance-type').value;
        const part = document.getElementById('maintenance-part').value;
        const day = document.getElementById('maintenance-day').value;
        const month = document.getElementById('maintenance-month').value;
        const year = document.getElementById('maintenance-year').value;
        const comments = document.getElementById('maintenance-comments').value;
    
        console.log('Form values:', { type, part, day, month, year, comments });
    
        let record = `${type} on: ${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        record += `, Part: ${part}`;
        if (comments) {
            record += `, Comments: ${comments}`;
        }
    
        // Stok kontrolü ve güncelleme
        if (type === 'Changed' && part !== 'None') {
            console.log('Checking stock for part:', part, 'Current stock:', stockInventory[part]);
            if (stockInventory[part] > 0) {
                stockInventory[part] -= 1;
                saveStockInventory();
                console.log('Stock updated:', stockInventory[part]);
    
                const manufacturer = document.getElementById('manufacturer').value;
                const warrantyType = document.getElementById('warranty-type').value;
                const purchaseDay = document.getElementById('purchase-day').value;
                const purchaseMonth = document.getElementById('purchase-month').value;
                const purchaseYear = document.getElementById('purchase-year').value;
    
                console.log('Replacement details:', { manufacturer, warrantyType, purchaseDay, purchaseMonth, purchaseYear });
    
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
                console.log('Stock is 0, cannot save');
                alert('Stokta yeterli parça yok! Lütfen depoyu kontrol edin.');
                return;
            }
        }
    
        console.log('Saving record:', record);
    
        if (!maintenanceHistory[selectedLamp]) {
            maintenanceHistory[selectedLamp] = [];
        }
        maintenanceHistory[selectedLamp].push(record);
        
        localStorage.setItem('maintenanceHistory', JSON.stringify(maintenanceHistory));
        
        showHistory(selectedLamp);
        
        document.getElementById('maintenance-input').style.display = 'none';
        console.log('saveMaintenance completed');
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

// Populate Year Filter Dropdown
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

//Filtering the Histories
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

//Reset History Filters 
function resetFilters() {
    document.getElementById('filter-type').value = 'all';
    document.getElementById('filter-year').value = 'all';
    document.getElementById('history-search').value = '';
    filterHistories();
}

//Exporting Maintenance History as a CSV File
function exportToCSV() {
    // Prepare CSV content
    let csvContent = "Lamp ID,Record\n"; // CSV header

    // Loop through all lamps and their histories
    lamps.forEach(lamp => {
        const history = maintenanceHistory[lamp.id] || [];
        history.forEach(record => {
            // Escape commas in the record by wrapping in quotes
            const escapedRecord = `"${record.replace(/"/g, '""')}"`;
            csvContent += `${lamp.id},${escapedRecord}\n`;
        });
    });

    // Create a Blob with the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Create a temporary link to download the file
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'lamp_maintenance_history.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    URL.revokeObjectURL(url);
}

//Initilazing the carousel
function initializeCarousel() {
    if (isCarouselInitialized) {
        return;
    }
    slides = document.getElementsByClassName('carousel-slide');
    goToSlide(0);
    isCarouselInitialized = true;
}

function goToSlide(index) {
    if (!slides || slides.length === 0) return;
    currentSlide = index;
    if (currentSlide < 0) currentSlide = slides.length - 1;
    if (currentSlide >= slides.length) currentSlide = 0;
    const offset = -currentSlide * 100;
    document.getElementById('carousel').style.transform = `translateX(${offset}%)`;
    updateDots();
    updateCanvasVisibility();
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
    const canvas = document.querySelector('canvas');
    
    if (!canvas) {
        console.error('p5.js canvas not found');
        return;
    }
    if (!maintenanceCanvasEl || !warrantyCanvasEl) {
        console.error('Canvas container not found:', { maintenanceCanvasEl, warrantyCanvasEl });
        return;
    }
    
    if (currentSlide === 0) {
        maintenanceCanvasEl.appendChild(canvas);
        console.log('Canvas attached to Maintenance Map');
    } else {
        warrantyCanvasEl.appendChild(canvas);
        console.log('Canvas attached to Warranty Map');
    }
}

// p5.js Sketch for the Map
function setup() {
    maintenanceCanvas = createCanvas(600, 400);
    maintenanceCanvas.parent('map-canvas');
    warrantyCanvas = createCanvas(600, 400);
    warrantyCanvas.parent('map-canvas-warranty');
    
    populateDropdowns();
    setupLamps();
}

function draw() {
    if (currentSlide === 0) {
        // Maintenance Map
        background(255);
        drawingContext.shadowBlur = 10;
        drawingContext.shadowColor = "rgba(0, 0, 0, 0.2)";
        stroke(0);
        strokeWeight(2);
        fill(200, 200, 200);
        rect(50, 50, 500, 300, 10);
        drawingContext.shadowBlur = 0;

        fill(255);
        rect(150, 50, 300, 30);
        fill(0);
        textFont('Poppins');
        textSize(16);
        stroke(255);
        strokeWeight(2);
        textAlign(CENTER, CENTER);
        text("Whiteboard", 300, 65);
        noStroke();

        fill(255, 165, 0);
        rect(470, 300, 30, 50);
        fill(0);
        textFont('Poppins');
        textSize(14);
        stroke(255);
        strokeWeight(2);
        text("Door", 485, 325);
        noStroke();

        lamps.forEach(lamp => {
            let lampColor = getLampColor(lamp.id);
            if (hoveredLamp === lamp.id) {
                drawingContext.shadowBlur = 5;
                drawingContext.shadowColor = "rgba(0, 0, 0, 0.3)";
                fill(255, 0, 0);
                stroke(0);
                strokeWeight(3);
            } else {
                drawingContext.shadowBlur = 3;
                drawingContext.shadowColor = "rgba(0, 0, 0, 0.2)";
                fill(lampColor.r, lampColor.g, lampColor.b);
                stroke(0);
                strokeWeight(1);
            }
            rect(lamp.x, lamp.y, lamp.width, lamp.height, 5);
            drawingContext.shadowBlur = 0;

            fill(0);
            textFont('Poppins');
            textSize(12);
            stroke(255);
            strokeWeight(1);
            textAlign(CENTER, CENTER);
            text(lamp.id, lamp.x + lamp.width / 2, lamp.y + lamp.height / 2);
            noStroke();
        });
    } else if (currentSlide === 1) {
        // Warranty Map
        background(255);
        drawingContext.shadowBlur = 10;
        drawingContext.shadowColor = "rgba(0, 0, 0, 0.2)";
        stroke(0);
        strokeWeight(2);
        fill(200, 200, 200);
        rect(50, 50, 500, 300, 10);
        drawingContext.shadowBlur = 0;

        fill(255);
        rect(150, 50, 300, 30);
        fill(0);
        textFont('Poppins');
        textSize(16);
        stroke(255);
        strokeWeight(2);
        textAlign(CENTER, CENTER);
        text("Whiteboard", 300, 65);
        noStroke();

        fill(255, 165, 0);
        rect(470, 300, 30, 50);
        fill(0);
        textFont('Poppins');
        textSize(14);
        stroke(255);
        strokeWeight(2);
        text("Door", 485, 325);
        noStroke();

        lamps.forEach(lamp => {
            let lampColor = getWarrantyColor(lamp.id);
            if (hoveredLamp === lamp.id) {
                drawingContext.shadowBlur = 5;
                drawingContext.shadowColor = "rgba(0, 0, 0, 0.3)";
                fill(lampColor.r > 200 ? 150 : lampColor.r, lampColor.g > 200 ? 150 : lampColor.g, lampColor.b > 200 ? 150 : lampColor.b);
                stroke(0);
                strokeWeight(3);
            } else {
                drawingContext.shadowBlur = 3;
                drawingContext.shadowColor = "rgba(0, 0, 0, 0.2)";
                fill(lampColor.r, lampColor.g, lampColor.b);
                stroke(0);
                strokeWeight(1);
            }
            rect(lamp.x, lamp.y, lamp.width, lamp.height, 5);
            drawingContext.shadowBlur = 0;

            fill(0);
            textFont('Poppins');
            textSize(12);
            stroke(255);
            strokeWeight(1);
            textAlign(CENTER, CENTER);
            text(lamp.id, lamp.x + lamp.width / 2, lamp.y + lamp.height / 2);
            noStroke();
        });
    }
}

function getLampColor(lampId) {
    const history = maintenanceHistory[lampId] || [];
    if (history.length === 0) {
        return { r: 128, g: 128, b: 128 }; // Gray (no maintenance)
    }

    // Get the latest maintenance record
    const latestRecord = history[history.length - 1];
    const dateStr = latestRecord.match(/\d{4}-\d{2}-\d{2}/)[0];
    const maintenanceDate = new Date(dateStr);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate - maintenanceDate);
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365); // Years difference

    if (diffYears > 5) {
        return { r: 255, g: 0, b: 0 }; // Red (5+ years)
    } else if (diffYears <= 2) {
        return { r: 0, g: 255, b: 0 }; // Green (within 2 years)
    } else {
        return { r: 255, g: 255, b: 0 }; // Yellow (2-5 years)
    }
}

// Handle lamp clicks
function mousePressed() {
    for (let lamp of lamps) {
        if (currentSlide === 0 && mouseX > lamp.x && mouseX < lamp.x + lamp.width &&
            mouseY > lamp.y && mouseY < lamp.y + lamp.height) {
            selectedLamp = lamp.id;
            document.getElementById('maintenance-input').style.display = 'block';
            document.getElementById('selected-lamp').textContent = lamp.id;
            showHistory(lamp.id);
            break;
        } else if (currentSlide === 1 && mouseX > lamp.x && mouseX < lamp.x + lamp.width &&
            mouseY > lamp.y && mouseY < lamp.y + lamp.height) {
            selectedLamp = lamp.id;
            document.getElementById('warranty-details').style.display = 'block';
            document.getElementById('selected-lamp-warranty').textContent = lamp.id;
            showWarrantyDetails(lamp.id);
            break;
        }
    }
}

function mouseMoved() {
    const tooltip = currentSlide === 0 ? document.getElementById('lamp-tooltip') : document.getElementById('lamp-tooltip-warranty');
    hoveredLamp = null;

    for (let lamp of lamps) {
        if (mouseX > lamp.x && mouseX < lamp.x + lamp.width &&
            mouseY > lamp.y && mouseY < lamp.y + lamp.height) {
            hoveredLamp = lamp.id;
            const history = maintenanceHistory[lamp.id] || [];
            const latestRecord = history.length > 0 ? history[history.length - 1] : "No maintenance recorded";
            const warrantyInfo = getWarrantyInfo(lamp.id);
            tooltip.textContent = currentSlide === 0 ? `Lamp ${lamp.id}: ${latestRecord}` : `Lamp ${lamp.id}: ${warrantyInfo.tooltip}`;
            tooltip.style.display = 'block';
            tooltip.style.left = (mouseX + 10) + 'px';
            tooltip.style.top = (mouseY - 30) + 'px';
            break;
        }
    }

    if (!hoveredLamp) {
        tooltip.style.display = 'none';
    }
}

function toggleReplacementDetails() {
    const partSelect = document.getElementById('maintenance-part');
    const typeSelect = document.getElementById('maintenance-type');
    const replacementDetails = document.getElementById('replacement-details');
    const stockInfo = document.getElementById('stock-info');
    const stockQuantity = document.getElementById('stock-quantity');
    const stockProgress = document.getElementById('stock-progress');
    const stockWarning = document.getElementById('stock-warning');

    // "Type" "Changed" ve "Part Affected" "None" değilse Replacement Details aç
    if (typeSelect.value === 'Changed' && partSelect.value !== 'None') {
        replacementDetails.style.display = 'block';
        stockInfo.style.display = 'block';

        // Seçilen parçanın stok miktarını göster
        const selectedPart = partSelect.value;
        const quantity = stockInventory[selectedPart] || 0;
        stockQuantity.textContent = `${quantity} available`;

        // İlerleme çubuğunu güncelle (maksimum stok varsayılan olarak 10 kabul edelim)
        const maxStock = 10;
        const percentage = (quantity / maxStock) * 100;
        stockProgress.style.width = `${percentage}%`;

        // Stok durumuna göre renk ve uyarı mesajı güncelle
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

function resetMaintenanceForm() {
    // Reset form fields
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
    
    // Hide replacement details
    document.getElementById('replacement-details').style.display = 'none';
    document.getElementById('warranty-duration').style.display = 'block';
    document.getElementById('warranty-end-date').style.display = 'none';
}

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

function showWarrantyDetails(lampId) {
    const info = getWarrantyInfo(lampId);
    document.getElementById('warranty-manufacturer').textContent = `Manufacturer: ${info.manufacturer}`;
    document.getElementById('warranty-purchase-date').textContent = `Purchase Date: ${info.purchaseDate}`;
    document.getElementById('warranty-status').textContent = `Warranty Status: ${info.status}`;
    document.getElementById('warranty-info').textContent = info.details ? `Warranty ${info.details}` : '';
}
