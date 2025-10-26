document.addEventListener('DOMContentLoaded', function () {

    function initializeSortable(elementId, reorderUrl) {
        const sortableList = document.getElementById(elementId);
        if (sortableList) {
            new Sortable(sortableList, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                handle: '.grabber',
                onEnd: function (evt) {
                    const rows = sortableList.querySelectorAll('tr');
                    const orderedIds = Array.from(rows).map(row => row.dataset.id);
                    fetch(reorderUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ordered_ids: orderedIds }),
                    }).then(response => response.json()).then(data => {
                        if (data.status !== 'success') {
                            alert('Lỗi khi cập nhật thứ tự: ' + data.message);
                        }
                    }).catch(err => console.error(err));
                },
            });
        }
    }

    function initializeImportForm() {
        const importForm = document.getElementById('import-form');
        if (importForm) {
            importForm.addEventListener('submit', function(e) {
                const fileInput = document.getElementById('json_file');
                const collectionNameInput = document.getElementById('collection_name');
                if (fileInput.files.length === 0 || !collectionNameInput.value.trim()) {
                    alert('Vui lòng nhập tên bộ sưu tập và chọn một file JSON.');
                    e.preventDefault();
                    return;
                }
                const submitBtn = document.getElementById('import-submit-btn');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.querySelector('#import-btn-text').textContent = 'Đang xử lý...';
                    submitBtn.querySelector('#import-loading-spinner').classList.remove('hidden');
                }
            });
        }
    }

    function initializeVisibilityToggle() {
        document.querySelectorAll('.visibility-toggle-btn').forEach(button => {
            button.addEventListener('click', function() {
                const collectionId = this.dataset.id;
                const statusText = this.querySelector('.status-text');
                const statusDot = this.querySelector('.status-dot');

                fetch(`/admin/collections/toggle-visibility/${collectionId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        if (data.is_visible) {
                            statusDot.classList.replace('text-slate-400', 'text-green-600');
                        } else {
                            statusDot.classList.replace('text-green-600', 'text-slate-400');
                        }
                        statusText.textContent = data.new_status;
                    } else {
                        alert('Lỗi: ' + data.message);
                    }
                })
                .catch(error => console.error('Error:', error));
            });
        });
    }

    initializeSortable('sortable-topics', '/admin/topics/reorder');
    initializeSortable('sortable-words', '/admin/words/reorder');
    initializeImportForm();
    initializeVisibilityToggle();
});
