// Levenshtein mesafesi hesaplayıcı (benzerlik için)
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

// İçerikteki tüm metinleri indeksleme
let searchIndex = [];
function buildSearchIndex() {
    let sections = document.getElementsByTagName("section");
    for (let i = 0; i < sections.length; i++) {
        let section = sections[i];
        let sectionTitle = section.querySelector('h2')?.textContent || "Section";
        let children = section.querySelectorAll("h2, h3, h4, p");
        children.forEach(child => {
            let text = child.textContent.trim();
            if (text) {
                searchIndex.push({
                    text: text.toLowerCase(),
                    originalText: text,
                    element: child,
                    section: section,
                    sectionTitle: sectionTitle,
                    sectionId: section.id
                });
            }
        });
    }
}

// Arama fonksiyonu
function searchContent() {
    let search = document.getElementById('searchBar').value.trim();
    if (!search) {
        resetSearch();
        return;
    }

    search = search.toLowerCase().replace(/\s+/g, ' ').trim();
    let sections = document.getElementsByTagName("section");
    let resultsList = document.getElementById('results-list');
    let searchResults = document.getElementById('search-results');
    let noResults = document.getElementById('no-results');
    let suggestionSpan = document.getElementById('suggestion');
    let searchStats = document.getElementById('search-stats');
    let results = [];

    // Önce tüm vurguları ve görünürlükleri sıfırla
    resetSearch();

    // Arama sonuçlarını hesapla
    searchIndex.forEach(item => {
        let distance = levenshteinDistance(search, item.text);
        let exactMatch = item.text.includes(search);
        let score = exactMatch ? 1 : (distance / Math.max(search.length, item.text.length));

        if (exactMatch || distance < 3) { // Yakın eşleşmeler için sınır
            results.push({
                score: exactMatch ? 1 : 1 - score, // Tam eşleşme en yüksek skoru alır
                item: item
            });
        }
    });

    // Sonuçları skora göre sırala
    results.sort((a, b) => b.score - a.score);

    // Sonuçları göster
    resultsList.innerHTML = '';
    let visibleSections = new Set();
    let matchCount = 0;

    results.forEach(result => {
        let item = result.item;
        visibleSections.add(item.section);
        matchCount++;
        highlightText(item.element, search);

        // Sonuç listesine ekle
        let li = document.createElement('li');
        let a = document.createElement('a');
        a.href = `#${item.sectionId}`;
        a.textContent = `${item.sectionTitle}: ${item.originalText.substring(0, 50)}${item.originalText.length > 50 ? '...' : ''}`;
        a.onclick = (e) => {
            e.preventDefault();
            item.section.scrollIntoView({ behavior: 'smooth' });
        };
        li.appendChild(a);
        resultsList.appendChild(li);
    });

    // Bölümleri göster/gizle
    for (let i = 0; i < sections.length; i++) {
        sections[i].style.display = visibleSections.has(sections[i]) ? "block" : "none";
    }

    // Arama istatistikleri ve sonuçları göster
    if (results.length > 0) {
        searchResults.style.display = 'block';
        noResults.style.display = 'none';
        searchStats.textContent = `${results.length} result(s) found in ${visibleSections.size} section(s).`;
    } else {
        searchResults.style.display = 'block';
        noResults.style.display = 'block';
        searchStats.textContent = '';

        // Öneri bul
        let bestSuggestion = '';
        let bestDistance = Infinity;
        searchIndex.forEach(item => {
            let distance = levenshteinDistance(search, item.text);
            if (distance < bestDistance && distance < 3) {
                bestDistance = distance;
                bestSuggestion = item.originalText;
            }
        });

        if (bestSuggestion) {
            suggestionSpan.innerHTML = `<a href="#" onclick="document.getElementById('searchBar').value='${bestSuggestion}'; searchContent(); return false;">${bestSuggestion}</a>`;
        } else {
            suggestionSpan.innerHTML = '';
        }
    }
}

// Otomatik tamamlama önerileri
let activeSuggestionIndex = -1;
function showSuggestions() {
    let search = document.getElementById('searchBar').value.trim().toLowerCase();
    let suggestionsDiv = document.getElementById('suggestions');
    suggestionsDiv.innerHTML = '';

    if (!search) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    let suggestions = new Set();
    searchIndex.forEach(item => {
        if (item.text.includes(search) && suggestions.size < 5) {
            suggestions.add(item.originalText);
        }
    });

    if (suggestions.size === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    suggestions.forEach(suggestion => {
        let div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = suggestion;
        div.onclick = () => {
            document.getElementById('searchBar').value = suggestion;
            searchContent();
            suggestionsDiv.style.display = 'none';
        };
        suggestionsDiv.appendChild(div);
    });

    suggestionsDiv.style.display = 'block';
    activeSuggestionIndex = -1;
}

// Klavye navigasyonu için
document.getElementById('searchBar').addEventListener('keydown', (e) => {
    let suggestionsDiv = document.getElementById('suggestions');
    let suggestionItems = suggestionsDiv.getElementsByClassName('suggestion-item');

    if (suggestionsDiv.style.display !== 'block') return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, suggestionItems.length - 1);
        updateActiveSuggestion(suggestionItems);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, -1);
        updateActiveSuggestion(suggestionItems);
    } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
        e.preventDefault();
        suggestionItems[activeSuggestionIndex].click();
    }
});

function updateActiveSuggestion(suggestionItems) {
    for (let i = 0; i < suggestionItems.length; i++) {
        suggestionItems[i].classList.remove('active');
        if (i === activeSuggestionIndex) {
            suggestionItems[i].classList.add('active');
            suggestionItems[i].scrollIntoView({ block: 'nearest' });
        }
    }
}

// Arama çubuğunda gerçek zamanlı arama ve öneriler
document.getElementById("searchBar").addEventListener("input", function() {
    showSuggestions();
});

// Önerileri gizle
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        document.getElementById('suggestions').style.display = 'none';
    }
});

// Önceki vurguları ve görünürlükleri sıfırlama fonksiyonu
function resetSearch() {
    let sections = document.getElementsByTagName("section");
    let searchResults = document.getElementById('search-results');
    let resultsList = document.getElementById('results-list');
    let noResults = document.getElementById('no-results');
    let searchStats = document.getElementById('search-stats');

    // Tüm bölümleri görünür yap ve vurguları kaldır
    for (let i = 0; i < sections.length; i++) {
        sections[i].style.display = "block";
        let children = sections[i].querySelectorAll("h2, h3, h4, p");
        children.forEach(child => {
            child.style.display = "block";
            child.innerHTML = child.textContent; // Vurguları kaldır
        });
    }

    // Arama sonuçlarını gizle
    searchResults.style.display = 'none';
    resultsList.innerHTML = '';
    noResults.style.display = 'none';
    searchStats.textContent = '';
}

// Metni vurgulama fonksiyonu
function highlightText(element, searchTerm) {
    let text = element.textContent;
    let regex = new RegExp(`(${searchTerm})`, 'gi');
    element.innerHTML = text.replace(regex, '<span class="highlight">$1</span>');
}

// PDF görüntüleme için kod
function showPDF(pdfFile, pdfTitle, viewerId) {
    let viewer = document.getElementById(viewerId);
    
    // Eğer PDF zaten görünüyorsa, gizle
    if (viewer.innerHTML !== "") {
        viewer.innerHTML = "";
        return;
    }
    
    // PDF’yi göster
    viewer.innerHTML = `
        <h3>${pdfTitle}</h3>
        <iframe src="${pdfFile}" width="100%" height="500px" style="border: none;"></iframe>
    `;
}

// Feedback bölümünü gösterme ve kaydırma
function showFeedback() {
    const feedbackSection = document.getElementById("feedback-section");
    feedbackSection.style.display = "block";
    feedbackSection.scrollIntoView({ behavior: "smooth" });
}

// Geri bildirim gönderme
function submitFeedback() {
    let rating = document.getElementById("feedback").value;
    alert("Thank you! You rated the site " + rating + "/5.");
    document.getElementById("feedback-section").style.display = "none";
}

// Drop-down menü için tıklama işlevselliği
document.querySelectorAll(".dropdown-toggle").forEach(toggle => {
    toggle.addEventListener("click", function(e) {
        e.preventDefault();
        document.querySelectorAll(".dropdown-menu").forEach(menu => {
            if (menu !== this.nextElementSibling) {
                menu.style.display = "none";
            }
        });
        const dropdownMenu = this.nextElementSibling;
        dropdownMenu.style.display = dropdownMenu.style.display === "block" ? "none" : "block";
    });
});

// Bağlantılara tıklandığında kaydırma
document.querySelectorAll(".dropdown-menu a").forEach(link => {
    link.addEventListener("click", function(e) {
        e.preventDefault();
        const targetId = this.getAttribute("href").substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth" });
        }
        document.querySelectorAll(".dropdown-menu").forEach(menu => {
            menu.style.display = "none";
        });
    });
});

// Sayfa yüklendiğinde arama indeksini oluştur
document.addEventListener('DOMContentLoaded', buildSearchIndex);
