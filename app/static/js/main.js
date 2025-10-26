// --- LOGIC CHUYỂN ĐỔI GIAO DIỆN (THEME) ---
// Đặt ở đầu để thực thi ngay lập tức
const themeToggleBtn = document.getElementById("theme-toggle");
const themeToggleDarkIcon = document.getElementById("theme-toggle-dark-icon");
const themeToggleLightIcon = document.getElementById("theme-toggle-light-icon");

function applyTheme() {
  if (
    localStorage.getItem("color-theme") === "dark" ||
    (!("color-theme" in localStorage) &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
    if (themeToggleLightIcon) themeToggleLightIcon.classList.remove("hidden");
    if (themeToggleDarkIcon) themeToggleDarkIcon.classList.add("hidden");
  } else {
    document.documentElement.classList.remove("dark");
    if (themeToggleDarkIcon) themeToggleDarkIcon.classList.remove("hidden");
    if (themeToggleLightIcon) themeToggleLightIcon.classList.add("hidden");
  }
}
applyTheme();

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", function () {
    document.documentElement.classList.toggle("dark");
    const theme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    localStorage.setItem("color-theme", theme);
    if (themeToggleDarkIcon) themeToggleDarkIcon.classList.toggle("hidden");
    if (themeToggleLightIcon) themeToggleLightIcon.classList.toggle("hidden");
  });
}

// --- LOGIC ỨNG DỤNG HỌC TỪ VỰNG ---
document.addEventListener("DOMContentLoaded", async () => {
  // --- BIẾN TRẠNG THÁI VÀ DỮ LIỆU ---
  let fullVocabularyData = [];
  let topics = [];
  let userData = {};
  let userWordsData = {};
  let quizState = {};
  let spellingQuizState = {};
  let currentTopicId = null;
  let currentView = "list"; // 'list' or 'flashcard'
  let speechVoices = [];
  const srsIntervals = [1, 3, 7, 14, 30].map((d) => d * 24 * 60 * 60 * 1000);

  // --- THAM CHIẾU ĐẾN CÁC PHẦN TỬ GIAO DIỆN ---
  const ui = {
    topicNavigation: document.getElementById("topic-navigation"),
    vocabularyContainer: document.getElementById("vocabulary-container"),
    currentTopicTitle: document.getElementById("current-topic-title"),
    searchBox: document.getElementById("search-box"),
    viewToggle: document.getElementById("view-toggle"),
    noResults: document.getElementById("no-results"),
    menuToggle: document.getElementById("menu-toggle"),
    sidebar: document.getElementById("sidebar"),
    sidebarOverlay: document.getElementById("sidebar-overlay"),
    userMenuToggle: document.getElementById("user-menu-toggle"),
    userMenuDropdown: document.getElementById("user-menu-dropdown"),

    // Buttons
    quizBtn: document.getElementById("quiz-btn"),
    spellingQuizBtn: document.getElementById("spelling-quiz-btn"),
    listeningQuizBtn: document.getElementById("listening-quiz-btn"),
    mobileQuizToggle: document.getElementById("mobile-quiz-toggle"),
    mobileQuizDropdown: document.getElementById("mobile-quiz-dropdown"),
    mobileQuizBtn: document.getElementById("mobile-quiz-btn"),
    mobileSpellingQuizBtn: document.getElementById("mobile-spelling-quiz-btn"),
    mobileListeningQuizBtn: document.getElementById(
      "mobile-listening-quiz-btn"
    ),

    // Modals
    quizModal: document.getElementById("quiz-modal"),
    closeQuizBtn: document.getElementById("close-quiz-btn"),
    restartQuizBtn: document.getElementById("restart-quiz-btn"),
    nextQuizBtn: document.getElementById("next-quiz-btn"),
    spellingQuizModal: document.getElementById("spelling-quiz-modal"),
    closeSpellingQuizBtn: document.getElementById("close-spelling-quiz-btn"),
    checkSpellingQuizBtn: document.getElementById("check-spelling-quiz-btn"),
    nextSpellingQuizBtn: document.getElementById("next-spelling-quiz-btn"),
    playSpellingQuizSoundBtn: document.getElementById(
      "play-spelling-quiz-sound-btn"
    ),
    listeningQuizModal: document.getElementById("listening-quiz-modal"),
    closeListeningQuizBtn: document.getElementById("close-listening-quiz-btn"),
    restartListeningQuizBtn: document.getElementById(
      "restart-listening-quiz-btn"
    ),
    closeListeningResultsBtn: document.getElementById(
      "close-listening-results-btn"
    ),
    nextListeningQuizBtn: document.getElementById("next-listening-quiz-btn"),
    playListeningQuizSoundBtn: document.getElementById(
      "play-listening-quiz-sound-btn"
    ),
    progressModal: document.getElementById("progress-modal"),
    closeProgressBtn: document.getElementById("close-progress-btn"),

    // Translation Popup
    translationPopup: document.getElementById("translation-popup"),

    matchingQuizBtn: document.getElementById("matching-quiz-btn"),
    matchingQuizModal: document.getElementById("matching-quiz-modal"),
    closeMatchingQuizBtn: document.getElementById("close-matching-quiz-btn"),
    checkMatchingQuizBtn: document.getElementById("check-matching-quiz-btn"),

    fillBlankQuizBtn: document.getElementById("fill-blank-quiz-btn"),
    fillBlankModal: document.getElementById("fill-blank-modal"),
    closeFillBlankBtn: document.getElementById("close-fill-blank-btn"),
    nextFillBlankBtn: document.getElementById("next-fill-blank-btn"),
  };

  // --- CÁC HÀM KHỞI TẠO VÀ CÀI ĐẶT ---

  // Hàm khởi tạo chính
  async function initializeApp() {
    loadSpeechVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadSpeechVoices;
    }

    loadUserWordsData();

    try {
      const response = await fetch("/api/data");
      if (!response.ok) throw new Error(`Network error: ${response.status}`);
      const data = await response.json();
      topics = data.topics;
      fullVocabularyData = data.words;
      userData = data.user_data.reduce((acc, item) => {
        acc[item.word_id] = item;
        return acc;
      }, {});
      topics.sort((a, b) => a.position - b.position);
      if (topics.length > 0) currentTopicId = topics[0].id;
    } catch (error) {
      console.error("Failed to load vocabulary data:", error);
      if (ui.vocabularyContainer)
        ui.vocabularyContainer.innerHTML = `<p class="text-red-500 text-center col-span-full">Lỗi tải dữ liệu. Vui lòng kiểm tra lại kết nối.</p>`;
      return;
    }

    renderTopics();
    updateView(currentTopicId);
    setupEventListeners();
  }

  // Hàm cài đặt các trình lắng nghe sự kiện
  function setupEventListeners() {
    // Logic cho nút "Lên đầu trang"
    const scrollToTopBtn = document.getElementById("scroll-to-top-btn");
    if (scrollToTopBtn) {
      window.addEventListener("scroll", () => {
        if (window.scrollY > 300) {
          scrollToTopBtn.classList.add("visible");
        } else {
          scrollToTopBtn.classList.remove("visible");
        }
      });
      scrollToTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    if (ui.closeListeningResultsBtn) {
      ui.closeListeningResultsBtn.addEventListener("click", () =>
        closeModal(ui.listeningQuizModal)
      );
    }
    if (ui.restartListeningQuizBtn) {
      ui.restartListeningQuizBtn.addEventListener("click", startListeningQuiz);
    }

    // Điều hướng chủ đề
    if (ui.topicNavigation) {
      ui.topicNavigation.addEventListener("click", (e) => {
        const link = e.target.closest("a");
        if (link && link.dataset.topicId) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
          const topicId = isNaN(parseInt(link.dataset.topicId))
            ? link.dataset.topicId
            : parseInt(link.dataset.topicId);
          if (ui.searchBox) ui.searchBox.value = "";
          updateView(topicId);
          if (window.innerWidth < 768 && ui.sidebar && ui.sidebarOverlay) {
            ui.sidebar.classList.add("-translate-x-full");
            ui.sidebarOverlay.classList.add("hidden");
          }
        }
      });
    }

    // Gán sự kiện trực tiếp cho các nút quiz để đảm bảo hoạt động
    if (ui.quizBtn) ui.quizBtn.addEventListener("click", startQuiz);
    if (ui.listeningQuizBtn)
      ui.listeningQuizBtn.addEventListener("click", startListeningQuiz);
    if (ui.spellingQuizBtn)
      ui.spellingQuizBtn.addEventListener("click", startSpellingQuiz);

    if (ui.mobileQuizBtn)
      ui.mobileQuizBtn.addEventListener("click", (e) => {
        e.preventDefault();
        startQuiz();
        if (ui.mobileQuizDropdown)
          ui.mobileQuizDropdown.classList.add("hidden");
      });
    if (ui.mobileListeningQuizBtn)
      ui.mobileListeningQuizBtn.addEventListener("click", (e) => {
        e.preventDefault();
        startListeningQuiz();
        if (ui.mobileQuizDropdown)
          ui.mobileQuizDropdown.classList.add("hidden");
      });
    if (ui.mobileSpellingQuizBtn)
      ui.mobileSpellingQuizBtn.addEventListener("click", (e) => {
        e.preventDefault();
        startSpellingQuiz();
        if (ui.mobileQuizDropdown)
          ui.mobileQuizDropdown.classList.add("hidden");
      });

    // Các trình lắng nghe sự kiện khác
    let searchTimeout;
    if (ui.searchBox) {
      ui.searchBox.addEventListener("input", () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => handleSearch(ui.searchBox.value), 300);
      });
    }

    if (ui.closeResultsBtn) {
      ui.closeResultsBtn.addEventListener("click", () =>
        closeModal(ui.quizModal)
      );
    }

    if (ui.menuToggle)
      ui.menuToggle.addEventListener("click", () => {
        if (ui.sidebar) ui.sidebar.classList.remove("-translate-x-full");
        if (ui.sidebarOverlay) ui.sidebarOverlay.classList.remove("hidden");
      });

    if (ui.sidebarOverlay)
      ui.sidebarOverlay.addEventListener("click", () => {
        if (ui.sidebar) ui.sidebar.classList.add("-translate-x-full");
        if (ui.sidebarOverlay) ui.sidebarOverlay.classList.add("hidden");
      });

    if (ui.userMenuToggle)
      ui.userMenuToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        ui.userMenuDropdown.classList.toggle("hidden");
      });
    if (ui.mobileQuizToggle)
      ui.mobileQuizToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        ui.mobileQuizDropdown.classList.toggle("hidden");
      });

    document.addEventListener("click", (e) => {
      if (
        ui.mobileQuizToggle &&
        !ui.mobileQuizToggle.contains(e.target) &&
        ui.mobileQuizDropdown &&
        !ui.mobileQuizDropdown.contains(e.target)
      )
        ui.mobileQuizDropdown.classList.add("hidden");
      if (
        ui.userMenuToggle &&
        !ui.userMenuToggle.contains(e.target) &&
        ui.userMenuDropdown &&
        !ui.userMenuDropdown.contains(e.target)
      )
        ui.userMenuDropdown.classList.add("hidden");
    });

    // --- LOGIC DỊCH KHI BÔI ĐEN VĂN BẢN (DESKTOP & MOBILE) ---
    let translationTimeout; // Biến để kiểm soát thời gian chờ

    // Hàm xử lý chung khi kết thúc việc chọn văn bản (nhả chuột hoặc nhấc ngón tay)
    const handleSelectionEnd = (e) => {
      // Bỏ qua nếu sự kiện xảy ra trên các phần tử tương tác hoặc chính popup
      if (e.target.closest("button, input, a, #translation-popup")) {
        return;
      }

      clearTimeout(translationTimeout);

      // Đặt một khoảng chờ ngắn để việc chọn văn bản được ổn định
      translationTimeout = setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        // Chỉ dịch nếu là văn bản tiếng Anh hợp lệ
        if (
          selectedText.length > 1 &&
          /^[a-zA-Z0-9\s.,'?!-]+$/.test(selectedText)
        ) {
          // Trên thiết bị cảm ứng, getRangeAt(0) có thể lỗi nếu vùng chọn đã bị xóa
          if (selection.rangeCount === 0) return;

          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          // Đảm bảo vùng chọn có kích thước, vì nó có thể bằng 0 trên touchend
          if (rect.width > 0 || rect.height > 0) {
            showTranslationPopup(selectedText, rect);
          }
        }
      }, 200);
    };

    // Hàm xử lý chung khi bắt đầu tương tác (nhấn chuột hoặc chạm màn hình)
    const handleInteractionStart = (e) => {
      // Ẩn popup nếu tương tác bắt đầu bên ngoài nó
      if (ui.translationPopup && !ui.translationPopup.contains(e.target)) {
        hideTranslationPopup();
      }
    };

    // Gán sự kiện cho cả chuột và cảm ứng
    document.addEventListener("mouseup", handleSelectionEnd);
    document.addEventListener("touchend", handleSelectionEnd);

    document.addEventListener("mousedown", handleInteractionStart);
    document.addEventListener("touchstart", handleInteractionStart, {
      passive: true,
    }); // passive: true để tối ưu hiệu suất cuộn
    // --- KẾT THÚC LOGIC DỊCH ---

    if (ui.closeQuizBtn)
      ui.closeQuizBtn.addEventListener("click", () => closeModal(ui.quizModal));
    if (ui.closeSpellingQuizBtn)
      ui.closeSpellingQuizBtn.addEventListener("click", () =>
        closeModal(ui.spellingQuizModal)
      );
    if (ui.closeListeningQuizBtn)
      ui.closeListeningQuizBtn.addEventListener("click", () =>
        closeModal(ui.listeningQuizModal)
      );
    if (ui.closeProgressBtn)
      ui.closeProgressBtn.addEventListener("click", () =>
        closeModal(ui.progressModal)
      );

    if (ui.nextQuizBtn)
      ui.nextQuizBtn.addEventListener("click", () => {
        quizState.currentQuestionIndex++;
        generateQuizQuestion();
      });
    if (ui.restartQuizBtn)
      ui.restartQuizBtn.addEventListener("click", startQuiz);
    if (ui.checkSpellingQuizBtn)
      ui.checkSpellingQuizBtn.addEventListener(
        "click",
        checkSpellingQuizAnswer
      );
    if (ui.nextSpellingQuizBtn)
      ui.nextSpellingQuizBtn.addEventListener("click", () => {
        spellingQuizState.currentQuestionIndex++;
        generateSpellingQuizQuestion();
      });
    if (ui.nextListeningQuizBtn)
      ui.nextListeningQuizBtn.addEventListener("click", () => {
        quizState.currentQuestionIndex++;
        generateListeningQuizQuestion();
      });
    if (ui.restartListeningQuizBtn)
      ui.restartListeningQuizBtn.addEventListener("click", startListeningQuiz);

    if (ui.viewToggle)
      ui.viewToggle.addEventListener("change", () => {
        currentView = ui.viewToggle.checked ? "flashcard" : "list";
        updateView(currentTopicId);
      });

    if (ui.matchingQuizBtn)
      ui.matchingQuizBtn.addEventListener("click", startMatchingQuiz);
    if (ui.closeMatchingQuizBtn)
      ui.closeMatchingQuizBtn.addEventListener("click", () =>
        closeModal(ui.matchingQuizModal)
      );
    if (ui.checkMatchingQuizBtn)
      ui.checkMatchingQuizBtn.addEventListener(
        "click",
        checkMatchingQuizAnswer
      );

    if (ui.fillBlankQuizBtn)
      ui.fillBlankQuizBtn.addEventListener("click", startFillBlankQuiz);
    if (ui.closeFillBlankBtn)
      ui.closeFillBlankBtn.addEventListener("click", () =>
        closeModal(ui.fillBlankModal)
      );
    if (ui.nextFillBlankBtn)
      ui.nextFillBlankBtn.addEventListener("click", () => {
        fillBlankQuizState.currentQuestionIndex++;
        generateFillBlankQuestion();
      });
  }

  // --- CÁC HÀM HIỂN THỊ VÀ CẬP NHẬT GIAO DIỆN ---
  let fillBlankQuizState = {};
  function startFillBlankQuiz() {
    // Lọc những từ có câu ví dụ và không quá phức tạp
    const wordsWithExamples = getWordsForCurrentView().filter(
      (w) => w.example && w.word.split(" ").length === 1
    );
    if (wordsWithExamples.length < 4) {
      return alert("Cần ít nhất 4 từ có câu ví dụ để bắt đầu bài tập này.");
    }

    fillBlankQuizState = {
      questions: shuffleArray(wordsWithExamples).slice(0, 10),
      currentQuestionIndex: 0,
      sourceWords: wordsWithExamples,
    };

    openModal(ui.fillBlankModal);
    generateFillBlankQuestion();
  }

  function generateFillBlankQuestion() {
    if (
      fillBlankQuizState.currentQuestionIndex >=
      fillBlankQuizState.questions.length
    ) {
      closeModal(ui.fillBlankModal);
      return alert("Bạn đã hoàn thành bài tập Điền từ!");
    }

    const questionWord =
      fillBlankQuizState.questions[fillBlankQuizState.currentQuestionIndex];

    // Tạo câu bị khuyết
    const blankSentence = questionWord.example.replace(
      new RegExp(`\\b${questionWord.word}\\b`, "gi"),
      "_______"
    );
    document.getElementById("fill-blank-sentence").innerHTML = blankSentence;

    // Tạo các lựa chọn
    let options = [{ word: questionWord.word, isCorrect: true }];
    const distractors = shuffleArray(
      fillBlankQuizState.sourceWords.filter((w) => w.id !== questionWord.id)
    ).slice(0, 3);
    distractors.forEach((d) =>
      options.push({ word: d.word, isCorrect: false })
    );
    options = shuffleArray(options);

    const optionsContainer = document.getElementById("fill-blank-options");
    optionsContainer.innerHTML = "";
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className =
        "quiz-option block w-full text-center p-4 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition";
      btn.textContent = opt.word;
      btn.onclick = () => checkFillBlankAnswer(opt.isCorrect, btn);
      optionsContainer.appendChild(btn);
    });

    document.getElementById("fill-blank-progress").textContent = `Câu ${
      fillBlankQuizState.currentQuestionIndex + 1
    } / ${fillBlankQuizState.questions.length}`;
    ui.nextFillBlankBtn.classList.add("hidden");
  }

  function checkFillBlankAnswer(isCorrect, btnElement) {
    document
      .querySelectorAll("#fill-blank-options .quiz-option")
      .forEach((btn) => {
        btn.disabled = true;
      });

    const wordId =
      fillBlankQuizState.questions[fillBlankQuizState.currentQuestionIndex].id;
    updateSrsStatus(wordId, isCorrect);

    if (isCorrect) {
      btnElement.classList.add("correct");
    } else {
      btnElement.classList.add("incorrect");
      // Tìm và highlight đáp án đúng
      document
        .querySelectorAll("#fill-blank-options .quiz-option")
        .forEach((btn) => {
          if (
            btn.textContent ===
            fillBlankQuizState.questions[
              fillBlankQuizState.currentQuestionIndex
            ].word
          ) {
            btn.classList.add("correct");
          }
        });
    }
    ui.nextFillBlankBtn.classList.remove("hidden");
  }

  let matchingQuizState = {};
  let sortableMeanings;

  function startMatchingQuiz() {
    const words = getWordsForCurrentView();
    if (words.length < 5) {
      return alert("Cần ít nhất 5 từ để bắt đầu bài tập Nối từ.");
    }

    matchingQuizState.questions = shuffleArray(words).slice(0, 5);
    const meanings = shuffleArray(
      matchingQuizState.questions.map((q) => q.meaning)
    );

    const wordsList = document.getElementById("matching-words-list");
    const meaningsList = document.getElementById("matching-meanings-list");
    wordsList.innerHTML = "";
    meaningsList.innerHTML = "";

    matchingQuizState.questions.forEach((q, index) => {
      wordsList.innerHTML += `<li class="p-3 bg-slate-100 dark:bg-slate-700 rounded-md text-center" data-id="${q.id}">${q.word}</li>`;

      // Dùng data-meaning để lưu nghĩa gốc, giúp kiểm tra
      meaningsList.innerHTML += `<li class="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-md text-center cursor-grab" data-meaning="${meanings[index]}">${meanings[index]}</li>`;
    });

    // Khởi tạo kéo thả
    if (sortableMeanings) sortableMeanings.destroy();
    sortableMeanings = new Sortable(meaningsList, { animation: 150 });

    document.getElementById("matching-quiz-feedback").innerHTML = "";
    openModal(ui.matchingQuizModal);
  }

  function checkMatchingQuizAnswer() {
    const wordElements = document.querySelectorAll("#matching-words-list li");
    const meaningElements = document.querySelectorAll(
      "#matching-meanings-list li"
    );
    const feedbackEl = document.getElementById("matching-quiz-feedback");
    let correctCount = 0;

    meaningElements.forEach((meaningEl, index) => {
      const wordId = wordElements[index].dataset.id;
      const correctWord = matchingQuizState.questions.find(
        (q) => q.id == wordId
      );
      const userAnswer = meaningEl.dataset.meaning;

      const isCorrect = correctWord.meaning === userAnswer;
      if (isCorrect) {
        correctCount++;
        meaningEl.classList.add("correct");
      } else {
        meaningEl.classList.add("incorrect");
      }
      updateSrsStatus(wordId, isCorrect);
    });

    if (correctCount === 5) {
      feedbackEl.textContent = "Xuất sắc!";
      feedbackEl.className =
        "mt-4 text-center h-6 font-semibold text-green-600";
    } else {
      feedbackEl.textContent = `Bạn đã nối đúng ${correctCount}/5 từ.`;
      feedbackEl.className =
        "mt-4 text-center h-6 font-semibold text-yellow-600";
    }
  }

  function renderTopics() {
    if (!ui.topicNavigation) return;
    ui.topicNavigation.innerHTML = "";

    const createHeading = (text) => {
      const heading = document.createElement("h3");
      heading.className =
        "px-2 pt-4 pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider";
      heading.textContent = text;
      ui.topicNavigation.appendChild(heading);
    };

    createHeading("Học tập");
    const mainNavItems = [
      { id: "review", name: "Ôn tập", icon: "⏰" },
      { id: "favorites", name: "Từ đã lưu", icon: "★" },
      { id: "progress", name: "Tiến độ", icon: "📊" },
    ];

    mainNavItems.forEach((item) => {
      const link = document.createElement("a");
      link.href = "#";
      link.dataset.topicId = item.id;
      link.className = `flex items-center px-4 py-2 rounded-md text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-1 ${
        currentTopicId === item.id
          ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold"
          : ""
      }`;
      link.innerHTML = `<span class="mr-3 text-lg">${item.icon}</span> <span>${item.name}</span>`;
      if (item.id === "review") {
        // SỬA LẠI HOÀN TOÀN ĐOẠN LOGIC TÍNH TOÁN NÀY
        const now = new Date();
        const wordsToReviewCount = Object.values(userData).filter(
          (wordProgress) =>
            wordProgress.next_review_at &&
            new Date(wordProgress.next_review_at) <= now
        ).length;
        // KẾT THÚC PHẦN SỬA

        if (wordsToReviewCount > 0) {
          link.innerHTML += `<span class="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">${wordsToReviewCount}</span>`;
        }
      }
      ui.topicNavigation.appendChild(link);
    });

    const topicsByCategory = topics.reduce((acc, topic) => {
      const category = topic.category || "Chung";
      if (!acc[category]) acc[category] = [];
      acc[category].push(topic);
      return acc;
    }, {});

    createHeading("Bộ sưu tập");

    for (const category in topicsByCategory) {
      const categoryContainer = document.createElement("div");
      categoryContainer.className = "py-1";

      const headerButton = document.createElement("button");
      headerButton.className =
        "w-full flex justify-between items-center px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md transition-colors";

      const chevronIcon = `<svg class="w-4 h-4 transition-transform chevron-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
      headerButton.innerHTML = `<span>${category}</span>${chevronIcon}`;

      const topicsList = document.createElement("div");
      topicsList.className = "pl-4 mt-1 space-y-1";

      const isActiveCategory = topicsByCategory[category].some(
        (topic) => topic.id === currentTopicId
      );
      if (!isActiveCategory) {
        topicsList.classList.add("hidden");
      } else {
        headerButton.querySelector(".chevron-icon").classList.add("rotate-90");
      }

      topicsByCategory[category].forEach((topic) => {
        const topicElement = document.createElement("a");
        topicElement.href = "#";
        topicElement.dataset.topicId = topic.id;
        topicElement.className = `flex items-center px-4 py-2 rounded-md text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
          topic.id === currentTopicId
            ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold"
            : ""
        }`;

        const wordCount = fullVocabularyData.filter(
          (word) => word.topic_id === topic.id
        ).length;
        topicElement.innerHTML = `${topic.name}<span class="ml-auto text-xs font-mono bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">${wordCount}</span>`;
        topicsList.appendChild(topicElement);
      });

      headerButton.addEventListener("click", (e) => {
        e.stopPropagation();
        topicsList.classList.toggle("hidden");
        headerButton
          .querySelector(".chevron-icon")
          .classList.toggle("rotate-90");
      });

      categoryContainer.appendChild(headerButton);
      categoryContainer.appendChild(topicsList);
      ui.topicNavigation.appendChild(categoryContainer);
    }
  }

  function renderVocabulary(data) {
    if (!ui.vocabularyContainer) return;
    ui.vocabularyContainer.innerHTML = "";

    const canStartQuiz = data.length >= 4;
    const canStartSpellingQuiz =
      data.filter((w) => w.word.split(" ").length === 1).length > 0;

    if (ui.quizBtn) ui.quizBtn.style.display = canStartQuiz ? "flex" : "none";
    if (ui.listeningQuizBtn)
      ui.listeningQuizBtn.style.display = canStartQuiz ? "flex" : "none";
    if (ui.spellingQuizBtn)
      ui.spellingQuizBtn.style.display = canStartSpellingQuiz ? "flex" : "none";

    if (ui.mobileQuizBtn)
      ui.mobileQuizBtn.style.display = canStartQuiz ? "flex" : "none";
    if (ui.mobileListeningQuizBtn)
      ui.mobileListeningQuizBtn.style.display = canStartQuiz ? "flex" : "none";
    if (ui.mobileSpellingQuizBtn)
      ui.mobileSpellingQuizBtn.style.display = canStartSpellingQuiz
        ? "flex"
        : "none";

    if (data.length === 0) {
      if (ui.noResults) {
        ui.noResults.classList.remove("hidden");
        const msg = {
          favorites: [
            "Chưa có từ nào được lưu",
            "Nhấn vào ngôi sao ★ để lưu từ khó nhé.",
          ],
          review: ["Tuyệt vời!", "Bạn đã ôn tập hết các từ cho hôm nay."],
          default: ["Không tìm thấy kết quả", "Vui lòng thử một từ khóa khác."],
        };
        const currentMsg = msg[currentTopicId] || msg.default;
        ui.noResults.querySelector(".font-semibold").textContent =
          currentMsg[0];
        ui.noResults.querySelector(".text-sm").textContent = currentMsg[1];
      }
      if (ui.vocabularyContainer)
        ui.vocabularyContainer.classList.add("hidden");
      return;
    }
    if (ui.noResults) ui.noResults.classList.add("hidden");
    if (ui.vocabularyContainer)
      ui.vocabularyContainer.classList.remove("hidden");

    data.forEach((item) => {
      const wordData = userWordsData[item.id] || {};
      const isFavorited = wordData.isFavorite || false;
      const card = document.createElement("div");
      const englishExample = item.example
        ? item.example.split("(")[0].trim()
        : "";

      const cleanIpa = item.ipa ? item.ipa.replace(/[()]/g, "") : "";

      if (currentView === "flashcard") {
        card.className = "card-container h-56";
        card.innerHTML = `
                    <div class="card-inner rounded-xl bg-white dark:bg-slate-800 shadow-md cursor-pointer h-full">
                        <div class="card-face card-front p-4">
                            <div class="flex justify-end w-full absolute top-2 right-2">
                                <button class="speak-btn text-slate-400 hover:text-blue-500" data-text="${
                                  item.word
                                }">🔊</button>
                                <button class="favorite-btn text-slate-400 hover:text-yellow-400 ml-2 ${
                                  isFavorited ? "favorited" : ""
                                }" data-id="${item.id}">★</button>
                            </div>
                            <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-100 text-center">${
                              item.word
                            }</h3>
                            <p class="text-sm text-slate-400 mt-2">Nhấn để xem nghĩa</p>
                        </div>
                        <div class="card-face card-back bg-blue-50 dark:bg-slate-700 p-4">
                             <div class="flex justify-end w-full absolute top-2 right-2">
                                <button class="speak-btn text-slate-400 hover:text-blue-500" data-text="${
                                  item.word
                                }">🔊</button>
                                <button class="favorite-btn text-slate-400 hover:text-yellow-400 ml-2 ${
                                  isFavorited ? "favorited" : ""
                                }" data-id="${item.id}">★</button>
                            </div>
                            <p class="text-lg font-semibold text-blue-700 dark:text-blue-400 text-center">${
                              item.meaning
                            }</p>
                            <p class="italic text-slate-500 dark:text-slate-400 text-sm mt-1 text-center">(${
                              item.type
                            }) ${cleanIpa}</p>
                            <div class="mt-3 text-center text-sm text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2">
                                <span>"${item.example}"</span>
                                <button class="speak-btn text-blue-500 hover:text-blue-700" data-text="${englishExample}">🔊</button>
                            </div>
                        </div>
                    </div>
                `;
        card.onclick = (e) => {
          if (!e.target.closest("button")) {
            const cardInner = card.querySelector(".card-inner");
            if (cardInner) {
              cardInner.classList.toggle("is-flipped");
              if (cardInner.classList.contains("is-flipped"))
                speakText(item.word);
            }
          }
        };
      } else {
        card.className =
          "bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md transition-shadow hover:shadow-lg";
        card.innerHTML = `
                    <div class="flex justify-between items-start">
                        <h3 class="text-xl font-bold text-blue-600 dark:text-blue-400">${
                          item.word
                        }</h3>
                        <div class="flex items-center">
                            <button class="speak-btn text-slate-400 hover:text-blue-500" data-text="${
                              item.word
                            }">🔊</button>
                            <button class="favorite-btn text-slate-400 hover:text-yellow-400 ml-2 ${
                              isFavorited ? "favorited" : ""
                            }" data-id="${item.id}">★</button>
                        </div>
                    </div>
                    <p class="text-slate-500 dark:text-slate-400 italic my-1">${cleanIpa}</p>
                    <p class="text-lg text-slate-800 dark:text-slate-100 font-medium mt-2">${
                      item.meaning
                    }</p>
                    <div class="text-slate-600 dark:text-slate-300 mt-3 text-sm flex items-center gap-2">
                        <span>"${item.example}"</span>
                        <button class="speak-btn text-blue-500 hover:text-blue-700" data-text="${englishExample}">🔊</button>
                    </div>
                `;
      }
      ui.vocabularyContainer.appendChild(card);
    });

    document.querySelectorAll(".speak-btn").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        speakText(e.currentTarget.dataset.text);
      })
    );
    document.querySelectorAll(".favorite-btn").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(parseInt(e.target.dataset.id), e.target);
      })
    );
  }

  function updateView(topicId) {
    if (topicId === "progress") {
      currentTopicId = "progress";
      renderTopics();
      renderProgress();
      renderStats();
      renderChart();
      openModal(ui.progressModal);
      return;
    }

    currentTopicId = topicId;
    let words;
    let title;

    if (ui.vocabularyContainer)
      ui.vocabularyContainer.innerHTML = `<div class="text-center col-span-full p-10">Đang tải...</div>`;

    if (topicId === "favorites") {
      title = "Từ đã lưu";
      words = fullVocabularyData.filter(
        (word) => (userWordsData[word.id] || {}).isFavorite
      );
    } else if (topicId === "review") {
      title = "Ôn tập hôm nay";
      const now = new Date();
      words = fullVocabularyData.filter((word) => {
        const wordProgress = userData[word.id];
        // Lấy những từ có ngày ôn tập đã đến hạn
        return wordProgress && new Date(wordProgress.next_review_at) <= now;
      });
    } else {
      const topic = topics.find((t) => t.id === currentTopicId);
      title = topic ? topic.name : "Không xác định";
      words = fullVocabularyData.filter(
        (word) => word.topic_id === currentTopicId
      );
    }
    if (ui.currentTopicTitle) ui.currentTopicTitle.textContent = title;
    renderVocabulary(words);
    renderTopics();
  }

  function handleSearch(query) {
    const lowerCaseQuery = query.toLowerCase().trim();
    if (lowerCaseQuery === "") {
      updateView(currentTopicId);
      return;
    }
    const filteredWords = fullVocabularyData.filter(
      (word) =>
        word.word.toLowerCase().includes(lowerCaseQuery) ||
        word.meaning.toLowerCase().includes(lowerCaseQuery)
    );
    if (ui.currentTopicTitle)
      ui.currentTopicTitle.textContent = `Kết quả cho "${query}"`;
    renderVocabulary(filteredWords);
  }

  // --- CÁC HÀM TIỆN ÍCH VÀ QUẢN LÝ DỮ LIỆU ---

  async function updateSrsStatus(wordId, isCorrect) {
    try {
      const response = await fetch("/api/update_srs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word_id: wordId, is_correct: isCorrect }),
      });
      if (!response.ok) throw new Error("Failed to update SRS status");
      const result = await response.json();

      // Cập nhật trạng thái SRS ở phía client ngay lập tức
      userData[wordId] = userData[wordId] || {};
      userData[wordId].srs_level = result.new_level;
      console.log(`Word ${wordId} updated to SRS level ${result.new_level}`);
    } catch (error) {
      console.error("SRS Update Error:", error);
    }
  }

  async function showTranslationPopup(text, rect) {
    if (!ui.translationPopup) return;

    ui.translationPopup.innerHTML = "Đang dịch...";
    ui.translationPopup.classList.add("visible");

    // Recalculate position after making it visible but before setting top/left
    const popupWidth = ui.translationPopup.offsetWidth;
    const popupHeight = ui.translationPopup.offsetHeight;

    let popupTop = window.scrollY + rect.top - popupHeight - 10;
    let popupLeft =
      window.scrollX + rect.left + rect.width / 2 - popupWidth / 2;

    // Adjust if popup goes off-screen
    if (popupTop < window.scrollY) {
      // If it goes above the viewport
      popupTop = window.scrollY + rect.bottom + 10;
    }
    if (popupLeft < window.scrollX) {
      // If it goes off the left edge
      popupLeft = window.scrollX + 10;
    }
    if (popupLeft + popupWidth > window.innerWidth) {
      // If it goes off the right edge
      popupLeft = window.innerWidth - popupWidth - 10;
    }

    ui.translationPopup.style.top = `${popupTop}px`;
    ui.translationPopup.style.left = `${popupLeft}px`;

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text }),
      });

      if (!response.ok) throw new Error("Translation request failed");

      const data = await response.json();
      if (data.translatedText) {
        ui.translationPopup.innerHTML = data.translatedText;
      } else {
        ui.translationPopup.innerHTML = "Không thể dịch.";
      }
    } catch (error) {
      console.error("Translation error:", error);
      ui.translationPopup.innerHTML = "Lỗi dịch.";
    }
  }

  function hideTranslationPopup() {
    if (ui.translationPopup) {
      ui.translationPopup.classList.remove("visible");
    }
  }

  function loadSpeechVoices() {
    speechVoices = window.speechSynthesis.getVoices();
  }

  function loadUserWordsData() {
    const saved = localStorage.getItem("userWordsData");
    userWordsData = saved ? JSON.parse(saved) : {};
    updateDailyStreak();
  }

  function saveUserWordsData() {
    localStorage.setItem("userWordsData", JSON.stringify(userWordsData));
  }

  function updateDailyStreak() {
    const today = new Date().toDateString();
    const lastSession = localStorage.getItem("lastSessionDate");
    let streak = parseInt(localStorage.getItem("dailyStreak") || "0");
    if (lastSession !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      streak = lastSession === yesterday ? streak + 1 : 1;
      localStorage.setItem("lastSessionDate", today);
      localStorage.setItem("dailyStreak", streak);
    }
  }

  function toggleFavorite(wordId, element) {
    userWordsData[wordId] ||
      (userWordsData[wordId] = { level: 0, nextReview: null });
    userWordsData[wordId].isFavorite = !userWordsData[wordId].isFavorite;
    element.classList.toggle("favorited", userWordsData[wordId].isFavorite);
    saveUserWordsData();
    if ("favorites" === currentTopicId) updateView("favorites");
  }

  // function updateSrsStatus(wordId, isCorrect) {
  //   userWordsData[wordId] ||
  //     (userWordsData[wordId] = { level: 0, nextReview: null });
  //   let currentLevel = userWordsData[wordId].level || 0;
  //   isCorrect ? currentLevel++ : (currentLevel = Math.max(0, currentLevel - 1));
  //   userWordsData[wordId].level = currentLevel;
  //   userWordsData[wordId].nextReview =
  //     currentLevel > 0
  //       ? Date.now() +
  //         srsIntervals[Math.min(currentLevel - 1, srsIntervals.length - 1)]
  //       : Date.now() + 36e5;
  //   saveUserWordsData();
  //   renderTopics();
  // }

  function getWordsForCurrentView() {
    switch (currentTopicId) {
      case "favorites":
        return fullVocabularyData.filter(
          (e) => e.id in userWordsData && userWordsData[e.id].isFavorite
        );
      case "review":
        return fullVocabularyData.filter(
          (e) =>
            e.id in userWordsData &&
            userWordsData[e.id].nextReview <= Date.now()
        );
      case "progress":
        return [];
      default:
        return fullVocabularyData.filter((e) => e.topic_id === currentTopicId);
    }
  }

  function trackQuizTaken() {
    let count = parseInt(localStorage.getItem("quizzesTaken") || "0");
    localStorage.setItem("quizzesTaken", ++count);
  }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function openModal(modal) {
    if (modal) {
      modal.classList.remove("hidden");
      setTimeout(() => {
        modal.classList.remove("opacity-0");
        const modalContent = modal.querySelector("div > div");
        if (modalContent) modalContent.classList.remove("scale-95");
      }, 10);
    }
  }

  function closeModal(modal) {
    if (modal) {
      modal.classList.add("opacity-0");
      const modalContent = modal.querySelector("div > div");
      if (modalContent) modalContent.classList.add("scale-95");
      setTimeout(() => modal.classList.add("hidden"), 300);
    }
  }

  function speakText(text) {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.6; // Tốc độ chậm hơn
      const preferredVoices = [
        "Google US English",
        "Alex",
        "Microsoft David - English (United States)",
        "Daniel",
      ];
      utterance.voice =
        speechVoices.find((v) => preferredVoices.includes(v.name)) ||
        speechVoices.find((v) => "en-US" === v.lang);
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Trình duyệt của bạn không hỗ trợ phát âm.");
    }
  }

  // --- CÁC HÀM LIÊN QUAN ĐẾN QUIZ ---

  function startQuiz() {
    const words = getWordsForCurrentView();
    if (words.length < 4)
      return void alert(
        "Cần ít nhất 4 từ trong danh sách này để tạo bài trắc nghiệm."
      );
    trackQuizTaken();
    quizState = {
      questions: shuffleArray(words).slice(0, 10),
      currentQuestionIndex: 0,
      score: 0,
      sourceWords: words,
    };
    document.getElementById("quiz-content").style.display = "block";
    document.getElementById("quiz-results").style.display = "none";
    openModal(ui.quizModal);
    generateQuizQuestion();
  }

  function generateQuizQuestion() {
    if (quizState.currentQuestionIndex >= quizState.questions.length)
      return void showQuizResults();
    const questionWord = quizState.questions[quizState.currentQuestionIndex];
    const options = getQuizOptions(questionWord);
    document.getElementById(
      "quiz-question"
    ).textContent = `Từ "${questionWord.word}" có nghĩa là gì?`;
    const optionsContainer = document.getElementById("quiz-options");
    optionsContainer.innerHTML = "";
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className =
        "quiz-option block w-full text-left p-4 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition";
      btn.textContent = opt.meaning;
      btn.onclick = () => checkAnswer(opt.isCorrect, btn);
      optionsContainer.appendChild(btn);
    });
    document.getElementById("quiz-progress").textContent = `Câu ${
      quizState.currentQuestionIndex + 1
    } / ${quizState.questions.length}`;
    ui.nextQuizBtn.classList.add("hidden");
  }

  function getQuizOptions(correctWord) {
    let options = [{ meaning: correctWord.meaning, isCorrect: true }];
    const distractors = shuffleArray(
      quizState.sourceWords.filter((w) => w.id !== correctWord.id)
    ).slice(0, 3);
    distractors.forEach((d) =>
      options.push({ meaning: d.meaning, isCorrect: false })
    );
    return shuffleArray(options);
  }

  function checkAnswer(isCorrect, btnElement) {
    document.querySelectorAll("#quiz-options .quiz-option").forEach((btn) => {
      btn.disabled = true;
    });
    const wordId = quizState.questions[quizState.currentQuestionIndex].id;
    updateSrsStatus(wordId, isCorrect);
    if (isCorrect) {
      quizState.score++;
      btnElement.classList.add("correct");
    } else {
      btnElement.classList.add("incorrect");
      document.querySelectorAll("#quiz-options .quiz-option").forEach((btn) => {
        if (
          quizState.questions[quizState.currentQuestionIndex].meaning ===
          btn.textContent
        )
          btn.classList.add("correct");
      });
    }
    ui.nextQuizBtn.classList.remove("hidden");
  }

  function showQuizResults() {
    document.getElementById("quiz-content").style.display = "none";
    const resultsDiv = document.getElementById("quiz-results");
    resultsDiv.style.display = "block";
    const {
      score,
      questions: { length: total },
    } = quizState;
    const percentage = Math.round((score / total) * 100);
    document.getElementById("quiz-score").textContent = `${percentage}%`;
    let feedback =
      percentage >= 80
        ? "Làm tốt lắm!"
        : percentage >= 50
        ? "Khá tốt!"
        : "Cố gắng hơn nhé!";
    document.getElementById(
      "quiz-feedback"
    ).textContent = `Bạn đã trả lời đúng ${score} / ${total} câu. ${feedback}`;
  }

  function startSpellingQuiz() {
    const words = getWordsForCurrentView().filter(
      (w) => w.word.split(" ").length === 1
    );
    if (words.length < 1)
      return void alert("Không có từ phù hợp cho bài tập này.");
    trackQuizTaken();
    spellingQuizState = {
      questions: shuffleArray(words),
      currentQuestionIndex: 0,
    };
    openModal(ui.spellingQuizModal);
    generateSpellingQuizQuestion();
  }

  function generateSpellingQuizQuestion() {
    if (
      spellingQuizState.currentQuestionIndex >=
      spellingQuizState.questions.length
    )
      return (
        closeModal(ui.spellingQuizModal),
        void alert("Bạn đã hoàn thành bài tập Luyện nghe & Viết!")
      );
    const questionWord =
      spellingQuizState.questions[spellingQuizState.currentQuestionIndex];
    spellingQuizState.correctAnswer = questionWord.word;
    document.getElementById(
      "spelling-quiz-meaning"
    ).textContent = `Nghĩa: ${questionWord.meaning}`;
    const inputEl = document.getElementById("spelling-quiz-input");
    inputEl.value = "";
    inputEl.disabled = false;
    inputEl.focus();
    document.getElementById("spelling-quiz-feedback").innerHTML = "";
    ui.checkSpellingQuizBtn.classList.remove("hidden");
    ui.nextSpellingQuizBtn.classList.add("hidden");
    ui.playSpellingQuizSoundBtn.onclick = () => speakText(questionWord.word);
    speakText(questionWord.word);
  }

  function checkSpellingQuizAnswer() {
    const userAnswer = document
      .getElementById("spelling-quiz-input")
      .value.trim();
    const feedbackEl = document.getElementById("spelling-quiz-feedback");
    const isCorrect =
      userAnswer.toLowerCase() ===
      spellingQuizState.correctAnswer.toLowerCase();
    updateSrsStatus(
      spellingQuizState.questions[spellingQuizState.currentQuestionIndex].id,
      isCorrect
    );
    feedbackEl.innerHTML = isCorrect
      ? `<span class="text-green-600 font-semibold">Chính xác!</span>`
      : `<span class="text-red-600 font-semibold">Sai rồi! Đáp án đúng là: <strong>${spellingQuizState.correctAnswer}</strong></span>`;
    document.getElementById("spelling-quiz-input").disabled = true;
    ui.checkSpellingQuizBtn.classList.add("hidden");
    ui.nextSpellingQuizBtn.classList.remove("hidden");
  }

  function startListeningQuiz() {
    const words = getWordsForCurrentView();
    if (words.length < 4)
      return void alert(
        "Cần ít nhất 4 từ trong danh sách này để tạo bài trắc nghiệm."
      );
    trackQuizTaken();
    quizState = {
      type: "listening",
      questions: shuffleArray(words).slice(0, 10),
      currentQuestionIndex: 0,
      score: 0,
      sourceWords: words,
    };
    document.getElementById("listening-quiz-content").style.display = "block";
    document.getElementById("listening-quiz-results").style.display = "none";
    openModal(ui.listeningQuizModal);
    generateListeningQuizQuestion();
  }

  function generateListeningQuizQuestion() {
    if (quizState.currentQuestionIndex >= quizState.questions.length)
      return void showListeningQuizResults();
    const questionWord = quizState.questions[quizState.currentQuestionIndex];
    const options = getListeningQuizOptions(questionWord);
    ui.playListeningQuizSoundBtn.onclick = () => speakText(questionWord.word);
    speakText(questionWord.word);
    const optionsContainer = document.getElementById("listening-quiz-options");
    optionsContainer.innerHTML = "";
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className =
        "quiz-option block w-full text-center p-4 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition";
      btn.textContent = opt.word;
      btn.onclick = () => checkListeningAnswer(opt.isCorrect, btn);
      optionsContainer.appendChild(btn);
    });
    document.getElementById("listening-quiz-progress").textContent = `Câu ${
      quizState.currentQuestionIndex + 1
    } / ${quizState.questions.length}`;
    ui.nextListeningQuizBtn.classList.add("hidden");
  }

  function getListeningQuizOptions(correctWord) {
    let options = [{ word: correctWord.word, isCorrect: true }];
    const distractors = shuffleArray(
      quizState.sourceWords.filter((w) => w.id !== correctWord.id)
    ).slice(0, 3);
    distractors.forEach((d) =>
      options.push({ word: d.word, isCorrect: false })
    );
    return shuffleArray(options);
  }

  function checkListeningAnswer(isCorrect, btnElement) {
    const allOptionBtns = document.querySelectorAll(
      "#listening-quiz-options .quiz-option"
    );
    allOptionBtns.forEach((btn) => {
      btn.disabled = true;
    });
    const wordId = quizState.questions[quizState.currentQuestionIndex].id;
    updateSrsStatus(wordId, isCorrect);
    if (isCorrect) {
      quizState.score++;
      btnElement.classList.add("correct");
    } else {
      btnElement.classList.add("incorrect");
      allOptionBtns.forEach((btn) => {
        if (
          quizState.questions[quizState.currentQuestionIndex].word ===
          btn.textContent.split("\n")[0].trim()
        )
          btn.classList.add("correct");
      });
    }
    allOptionBtns.forEach((btn) => {
      const wordText = btn.textContent.split("\n")[0].trim();
      const wordObj = fullVocabularyData.find((w) => w.word === wordText);
      if (wordObj) {
        btn.classList.add("flex", "flex-col", "items-center", "justify-center");
        btn.innerHTML += `<span class="block text-xs text-slate-500 mt-1">(${wordObj.meaning})</span>`;
      }
    });
    ui.nextListeningQuizBtn.classList.remove("hidden");
  }

  function showListeningQuizResults() {
    document.getElementById("listening-quiz-content").style.display = "none";
    const resultsDiv = document.getElementById("listening-quiz-results");
    resultsDiv.style.display = "block";
    const {
      score,
      questions: { length: total },
    } = quizState;
    const percentage = Math.round((score / total) * 100);
    document.getElementById(
      "listening-quiz-score"
    ).textContent = `${percentage}%`;
    let feedback =
      percentage >= 80
        ? "Làm tốt lắm!"
        : percentage >= 50
        ? "Khá tốt!"
        : "Cố gắng hơn nhé!";
    document.getElementById(
      "listening-quiz-feedback"
    ).textContent = `Bạn đã trả lời đúng ${score} / ${total} câu. ${feedback}`;
  }

  // --- CÁC HÀM LIÊN QUAN ĐẾN TIẾN ĐỘ ---

  function renderStats() {
    if (document.getElementById("total-words-stat"))
      document.getElementById("total-words-stat").textContent =
        fullVocabularyData.length;
    if (document.getElementById("total-topics-stat"))
      document.getElementById("total-topics-stat").textContent = topics.length;
  }

  function renderChart() {
    const categoryCounts = topics.reduce((acc, topic) => {
      const category = topic.category || "Chung";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    const ctx = document.getElementById("topicChart").getContext("2d");
    if (window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(categoryCounts),
        datasets: [
          {
            label: "Số lượng chủ đề",
            data: Object.values(categoryCounts),
            backgroundColor: [
              "rgba(59, 130, 246, 0.7)",
              "rgba(16, 185, 129, 0.7)",
              "rgba(239, 68, 68, 0.7)",
              "rgba(245, 158, 11, 0.7)",
              "rgba(139, 92, 246, 0.7)",
            ],
            borderColor: [
              "#3B82F6",
              "#10B981",
              "#EF4444",
              "#F59E0B",
              "#8B5CF6",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" } },
      },
    });
  }

  function renderProgress() {
    const streak = localStorage.getItem("dailyStreak") || 0;
    const masteredCount = Object.values(userWordsData).filter(
      (w) => w.level >= 5
    ).length;
    const reviewCount = Object.values(userWordsData).filter(
      (w) => w.nextReview && w.nextReview <= Date.now()
    ).length;
    document.getElementById("progress-streak").textContent = streak;
    document.getElementById("progress-mastered").textContent = masteredCount;
    document.getElementById("progress-review").textContent = reviewCount;
    const badges = [
      {
        id: "streak-7",
        name: "Siêng năng",
        icon: "🔥",
        requirement: () => streak >= 7,
        desc: "Chuỗi 7 ngày học",
      },
      {
        id: "master-50",
        name: "Bậc thầy",
        icon: "🎓",
        requirement: () => masteredCount >= 50,
        desc: "Thuộc 50 từ",
      },
      {
        id: "explorer",
        name: "Nhà thám hiểm",
        icon: "🗺️",
        requirement: () => Object.keys(userWordsData).length >= 100,
        desc: "Học 100 từ",
      },
      {
        id: "quiz-master",
        name: "Vua trắc nghiệm",
        icon: "👑",
        requirement: () =>
          parseInt(localStorage.getItem("quizzesTaken") || 0) >= 10,
        desc: "Hoàn thành 10 bài trắc nghiệm",
      },
    ];
    const badgesContainer = document.getElementById("badges-container");
    badgesContainer.innerHTML = "";
    badges.forEach((badge) => {
      const isUnlocked = badge.requirement();
      const badgeEl = document.createElement("div");
      badgeEl.className = `text-center p-2 ${isUnlocked ? "" : "badge locked"}`;
      badgeEl.innerHTML = `<div class="text-4xl">${badge.icon}</div><p class="font-semibold text-sm mt-1">${badge.name}</p><p class="text-xs text-slate-500">${badge.desc}</p>`;
      badgesContainer.appendChild(badgeEl);
    });
  }

  // --- BẮT ĐẦU ỨNG DỤNG ---
  initializeApp();
});
