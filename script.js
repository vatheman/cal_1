// API 설정
const GEMINI_API_KEY = "AIzaSyAjTGu1cuDggpkmnskQx5y3M4-lxGUvlrw";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// DOM 요소들
const cameraBtn = document.getElementById('cameraBtn');
const galleryBtn = document.getElementById('galleryBtn');
const fileInput = document.getElementById('fileInput');
const previewSection = document.getElementById('previewSection');
const loadingSection = document.getElementById('loadingSection');
const resultSection = document.getElementById('resultSection');
const imageCanvas = document.getElementById('imageCanvas');
const analyzeBtn = document.getElementById('analyzeBtn');
const foodItems = document.getElementById('foodItems');
const totalCalories = document.getElementById('totalCalories');
const exerciseInfo = document.getElementById('exerciseInfo');
const copyBtn = document.getElementById('copyBtn');
const resetBtn = document.getElementById('resetBtn');
const sampleItems = document.querySelectorAll('.sample-item');

// 전역 변수
let currentImageData = null;

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
    cameraBtn.addEventListener('click', () => fileInput.click());
    galleryBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    analyzeBtn.addEventListener('click', analyzeImage);
    copyBtn.addEventListener('click', copyResults);
    resetBtn.addEventListener('click', resetApp);
    
    // 샘플 이미지 클릭 이벤트
    sampleItems.forEach(item => {
        item.addEventListener('click', () => {
            const imagePath = item.dataset.image;
            loadSampleImage(imagePath);
        });
    });
});

// 파일 선택 처리
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            displayImage(e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

// 샘플 이미지 로드
function loadSampleImage(imagePath) {
    displayImage(imagePath);
}

// 이미지 표시
function displayImage(imageSrc) {
    const img = new Image();
    img.onload = function() {
        const canvas = imageCanvas;
        const ctx = canvas.getContext('2d');
        
        // 캔버스 크기 설정
        const maxWidth = 400;
        const maxHeight = 300;
        let { width, height } = img;
        
        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }
        if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 이미지 그리기
        ctx.drawImage(img, 0, 0, width, height);
        
        // 이미지 데이터 저장
        currentImageData = canvas.toDataURL('image/jpeg', 0.8);
        
        // 미리보기 섹션 표시
        previewSection.style.display = 'block';
        resultSection.style.display = 'none';
        
        // 스크롤을 미리보기로 이동
        previewSection.scrollIntoView({ behavior: 'smooth' });
    };
    img.src = imageSrc;
}

// 이미지 분석
async function analyzeImage() {
    if (!currentImageData) {
        alert('이미지를 먼저 선택해주세요.');
        return;
    }
    
    // 로딩 상태 표시
    previewSection.style.display = 'none';
    loadingSection.style.display = 'block';
    
    try {
        // Base64 이미지 데이터에서 헤더 제거
        const base64Data = currentImageData.split(',')[1];
        
        // Gemini API 호출
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `다음 이미지에서 음식을 분석하고 칼로리를 계산해주세요. \n\n분석 요구사항:\n1. 이미지에서 식별 가능한 모든 음식을 찾아주세요\n2. 각 음식의 예상 칼로리를 계산해주세요 (1인분 기준)\n3. 계산 과정을 bullet point로 상세히 설명해주세요\n4. 총 칼로리를 합산해주세요\n5. 해당 칼로리를 소모하기 위한 운동 방법을 제시해주세요\n\n응답 형식:\n{\n    \"foods\": [\n        {\n            \"name\": \"음식명\",\n            \"calories\": 숫자,\n            \"details\": \"계산 과정 설명\"\n        }\n    ],\n    \"totalCalories\": 숫자,\n    \"exercises\": [\n        \"운동 방법 1\",\n        \"운동 방법 2\"\n    ]\n}\n\nJSON 형식으로만 응답해주세요.`
                    }, {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: base64Data
                        }
                    }]
                }]
            })
        });
        
        if (!response.ok) {
            loadingSection.style.display = 'none';
            alert(`API 호출 실패: ${response.status}`);
            resetApp();
            return;
        }
        
        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            loadingSection.style.display = 'none';
            alert('AI 응답이 예상과 다릅니다. 잠시 후 다시 시도해 주세요.');
            resetApp();
            return;
        }
        
        const responseText = data.candidates[0].content.parts[0].text;
        
        // JSON 파싱 시도
        let result;
        try {
            // JSON 부분만 추출
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('JSON 형식을 찾을 수 없습니다.');
            }
        } catch (parseError) {
            console.error('JSON 파싱 오류:', parseError);
            // 수동 파싱 시도
            result = parseManualResponse(responseText);
        }
        
        displayResults(result);
        
    } catch (error) {
        console.error('분석 오류:', error);
        loadingSection.style.display = 'none';
        alert(
            '이미지 분석 중 오류가 발생했습니다.\n' +
            '1. 인터넷 연결을 확인하세요.\n' +
            '2. API 키가 올바른지 확인하세요.\n' +
            '3. 브라우저 콘솔(F12)에서 에러 메시지를 확인해 주세요.'
        );
        resetApp();
    }
}

// 수동 응답 파싱 (API가 JSON을 반환하지 않을 경우)
function parseManualResponse(text) {
    const result = {
        foods: [],
        totalCalories: 0,
        exercises: []
    };
    
    // 음식 정보 추출
    const foodMatches = text.match(/([가-힣\s]+)\s*[:\-]\s*(\d+)\s*kcal/gi);
    if (foodMatches) {
        foodMatches.forEach(match => {
            const parts = match.split(/[:\-]/);
            if (parts.length >= 2) {
                const name = parts[0].trim();
                const calories = parseInt(parts[1].match(/\d+/)[0]);
                result.foods.push({
                    name: name,
                    calories: calories,
                    details: `${name}의 일반적인 1인분 칼로리`
                });
                result.totalCalories += calories;
            }
        });
    }
    
    // 운동 정보 추출
    const exerciseMatches = text.match(/(달리기|걷기|등산|수영|자전거|조깅|스쿼트|플랭크)[^0-9]*(\d+)[^가-힣]*/g);
    if (exerciseMatches) {
        exerciseMatches.forEach(match => {
            result.exercises.push(match.trim());
        });
    }
    
    // 기본 운동 정보 추가
    if (result.exercises.length === 0 && result.totalCalories > 0) {
        result.exercises = [
            `달리기 ${Math.round(result.totalCalories / 10)}분`,
            `걷기 ${Math.round(result.totalCalories / 5)}분`,
            `등산 ${Math.round(result.totalCalories / 15)}분`
        ];
    }
    
    return result;
}

// 결과 표시
function displayResults(result) {
    // 음식 항목들 표시
    foodItems.innerHTML = '';
    result.foods.forEach(food => {
        const foodItem = document.createElement('div');
        foodItem.className = 'food-item';
        foodItem.innerHTML = `
            <h4>${food.name}</h4>
            <div class="calories">${food.calories} kcal</div>
            <div class="details">${food.details}</div>
        `;
        foodItems.appendChild(foodItem);
    });
    
    // 총 칼로리 표시
    totalCalories.textContent = `${result.totalCalories} kcal`;
    
    // 운동 정보 표시
    exerciseInfo.innerHTML = `
        <h4>🔥 칼로리 소모를 위한 운동</h4>
        <ul class="exercise-list">
            ${result.exercises.map(exercise => `<li>${exercise}</li>`).join('')}
        </ul>
    `;
    
    // 결과 섹션 표시
    loadingSection.style.display = 'none'; // 분석 결과가 나오면 로딩 섹션 숨김
    resultSection.style.display = 'block';
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

// 결과 복사
async function copyResults() {
    const resultText = `
🍽️ 칼로리M 분석 결과

${Array.from(foodItems.children).map(item => {
    const name = item.querySelector('h4').textContent;
    const calories = item.querySelector('.calories').textContent;
    return `• ${name}: ${calories}`;
}).join('\n')}

총 예상 칼로리: ${totalCalories.textContent}

${exerciseInfo.querySelector('h4').textContent}
${Array.from(exerciseInfo.querySelectorAll('li')).map(li => `• ${li.textContent}`).join('\n')}
    `.trim();
    
    try {
        await navigator.clipboard.writeText(resultText);
        alert('결과가 클립보드에 복사되었습니다!');
    } catch (error) {
        console.error('복사 실패:', error);
        // 대체 방법
        const textArea = document.createElement('textarea');
        textArea.value = resultText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('결과가 클립보드에 복사되었습니다!');
    }
}

// 앱 리셋
function resetApp() {
    // 모든 섹션 숨기기
    previewSection.style.display = 'none';
    loadingSection.style.display = 'none';
    resultSection.style.display = 'none';
    
    // 파일 입력 초기화
    fileInput.value = '';
    
    // 전역 변수 초기화
    currentImageData = null;
    
    // 페이지 상단으로 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 모바일 최적화
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 모바일에서 카메라 접근 최적화
if (isMobile()) {
    fileInput.setAttribute('capture', 'environment');
}

// 에러 처리 개선
window.addEventListener('error', function(e) {
    console.error('전역 오류:', e.error);
});

// 네트워크 상태 확인
window.addEventListener('online', function() {
    console.log('네트워크 연결됨');
});

window.addEventListener('offline', function() {
    console.log('네트워크 연결 끊김');
    alert('인터넷 연결을 확인해주세요.');
});

// 성능 최적화
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 이미지 로드 최적화
const optimizedImageLoad = debounce(displayImage, 300); 