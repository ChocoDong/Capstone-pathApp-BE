const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 환경 변수나 설정 파일에서 API 키를 가져와야 합니다.
// 아래 코드는 예시로, 실제 구현 시 보안을 위해 환경 변수를 사용하세요.
const GOOGLE_MAPS_API_KEY = 'AIzaSyC8fok9-HjSp65TrWrVLcD9eceD7ZerMo0'; // 실제 키로 교체 필요
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // 환경 변수에서 OpenAI API 키를 가져옵니다
});

// Gemini 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // 환경 변수에서 Gemini API 키 가져오기

// POST /recommend-route
router.post('/', async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ error: '위도와 경도를 보내주세요.' });
        }

        // 1. Google Geocoding API를 사용하여 좌표를 주소로 변환
        const geocodeResponse = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=ko&key=${GOOGLE_MAPS_API_KEY}`
        );
        const geocodeData = await geocodeResponse.json();

        if (!geocodeData.results || geocodeData.results.length === 0) {
            return res.status(404).json({ error: '주소를 찾을 수 없습니다.' });
        }

        const formattedAddress = geocodeData.results[0].formatted_address;
        // 주소에서 주요 지역명 추출 (첫 번째 결과 사용)
        const locationName = extractLocationName(geocodeData.results[0]);

        // 2. OpenAI와 Gemini를 동시에 호출하고 결과 비교
        const [openaiRecommendations, geminiRecommendations] = await Promise.all([
            getOpenAIRecommendations(locationName || formattedAddress),
            getGeminiRecommendations(locationName || formattedAddress),
        ]);

        // 두 결과를 비교하고 동일한 장소만 반환
        const combinedRecommendations = compareAndCombineRecommendations(openaiRecommendations, geminiRecommendations);

        // 3. 응답 전송
        res.json({
            location: {
                latitude,
                longitude,
                address: formattedAddress,
                name: locationName,
            },
            recommendations: combinedRecommendations,
        });
    } catch (error) {
        console.error('추천 요청 처리 중 오류 발생:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// OpenAI로 추천 받기
async function getOpenAIRecommendations(location) {
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o', // GPT-4o 모델로 업데이트
            messages: [
                {
                    role: 'system',
                    content: '당신은 관광과 방문지에 대한 추천을 제공하는 한국 여행 전문가입니다.',
                },
                {
                    role: 'user',
                    content: `${location} 주변에서 방문할만한 장소 5곳을 추천해주세요. 각 장소마다 간략한 설명과 특징을 알려주세요. JSON 형식으로 응답해주세요.`,
                },
            ],
            response_format: { type: 'json_object' },
        });

        const recommendationsText = completion.choices[0].message.content;
        return JSON.parse(recommendationsText);
    } catch (error) {
        console.error('OpenAI 추천 요청 중 오류 발생:', error);
        throw error;
    }
}

// Gemini로 추천 받기
async function getGeminiRecommendations(location) {
    try {
        // Gemini 2.0 Flash 모델 사용
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: {
                temperature: 0.4,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 2048,
            },
        });

        const prompt = `당신은 관광과 방문지에 대한 추천을 제공하는 한국 여행 전문가입니다.
        ${location} 주변에서 방문할만한 장소 5곳을 추천해주세요. 각 장소마다 간략한 설명과 특징을 알려주세요.
        반드시 다음과 같은 JSON 형식으로 응답해주세요. 다른 텍스트나 설명은 포함하지 말고 JSON만 응답해주세요.
        
        {
          "places": [
            {
              "name": "장소명",
              "description": "장소 설명",
              "features": "장소 특징"
            }
          ]
        }`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // JSON 문자열 추출 및 파싱
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        } else {
            throw new Error('Gemini 응답에서 JSON을 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('Gemini 추천 요청 중 오류 발생:', error);
        throw error;
    }
}

// 두 API의 추천 결과를 비교하고 공통된 장소만 반환
function compareAndCombineRecommendations(openaiRecommendations, geminiRecommendations) {
    try {
        const openaiPlaces = openaiRecommendations.places || [];
        const geminiPlaces = geminiRecommendations.places || [];

        // 장소 이름으로 비교
        const openaiPlaceNames = openaiPlaces.map((place) => place.name.toLowerCase());
        const geminiPlaceNames = geminiPlaces.map((place) => place.name.toLowerCase());

        // 공통 장소 이름 찾기
        const commonPlaceNames = openaiPlaceNames.filter((name) =>
            geminiPlaceNames.some((geminiName) => geminiName.includes(name) || name.includes(geminiName))
        );

        // 공통 장소만 필터링하여 반환
        const commonPlaces = openaiPlaces.filter((place) =>
            commonPlaceNames.some(
                (commonName) =>
                    place.name.toLowerCase().includes(commonName) || commonName.includes(place.name.toLowerCase())
            )
        );

        return {
            places: commonPlaces.length > 0 ? commonPlaces : openaiPlaces,
        };
    } catch (error) {
        console.error('추천 결과 비교 중 오류 발생:', error);
        // 오류 발생 시 OpenAI 결과만 반환
        return openaiRecommendations;
    }
}

// 여행 경로 추천 API
router.post('/travel-route', async (req, res) => {
    console.log('여행 경로 추천 요청 받음:', req.body);

    try {
        const { startLocation, endLocation, leisureType, experienceType, travelDays } = req.body;

        // 출발지가 비어있으면 기본값 설정
        const finalStartLocation = startLocation || '현재 위치';
        // 여행 일수 기본값 설정 (입력이 없으면 3일)
        const days = travelDays ? parseInt(travelDays) : 3;

        if (!endLocation) {
            console.log('도착지 파라미터 누락');
            return res.status(400).json({ error: '도착지를 지정해주세요.' });
        }

        if (!leisureType || !experienceType) {
            console.log('여행 타입 누락:', { leisureType, experienceType });
            return res.status(400).json({ error: '여행 타입을 모두 선택해주세요.' });
        }

        console.log('AI API 호출 준비');

        // OpenAI와 Gemini를 동시에 호출하고 결과 비교
        const [openaiRouteRecommendation, geminiRouteRecommendation] = await Promise.all([
            getOpenAIRouteRecommendation(finalStartLocation, endLocation, leisureType, experienceType, days),
            getGeminiRouteRecommendation(finalStartLocation, endLocation, leisureType, experienceType, days),
        ]);

        // 두 모델의 결과를 비교하고 공통된 결과만 반환
        const combinedRouteRecommendation = compareAndCombineRouteRecommendations(
            openaiRouteRecommendation,
            geminiRouteRecommendation
        );

        // 응답 전송
        console.log('클라이언트에 응답 전송');
        res.json({
            success: true,
            startLocation: finalStartLocation,
            endLocation,
            preferences: {
                leisureType: mapLeisureType(leisureType),
                experienceType: mapExperienceType(experienceType),
            },
            routeRecommendation: combinedRouteRecommendation,
        });
    } catch (error) {
        console.error('여행 경로 추천 중 오류 발생:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.', details: error.message });
    }
});

// OpenAI로 여행 경로 추천 받기
async function getOpenAIRouteRecommendation(startLocation, endLocation, leisureType, experienceType, days) {
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o', // GPT-4o 모델로 업데이트
        messages: [
            {
                role: 'system',
                content:
                    '당신은 한국 여행 전문가로, 여행자의 선호도에 맞는 최적의 여행 일정과 경로를 추천해주는 역할을 합니다. 제공하는 정보는 정확하고 실용적이어야 합니다.',
            },
            {
                role: 'user',
                content: `출발지: ${startLocation}
                도착지: ${endLocation}
                여행 스타일: ${mapLeisureType(leisureType)}, ${mapExperienceType(experienceType)}
                여행 일수: ${days}일
                
                위 정보를 바탕으로 ${days}일 일정의 여행 경로를 추천해주세요. 각 일자별로 2~3개의 방문지를 추천하고, 각 장소마다 간략한 설명과 특징을 알려주세요.
                
                반드시 다음 JSON 형식으로 응답해주세요:
                {
                  "title": "여행 제목",
                  "description": "여행 설명",
                  "days": [
                    {
                      "day": 1,
                      "places": [
                        {
                          "name": "장소명",
                          "description": "장소 설명",
                          "activity": "추천 활동",
                          "time": "방문 추천 시간"
                        }
                      ]
                    }
                  ]
                }`,
            },
        ],
        response_format: { type: 'json_object' },
    });

    const routeRecommendationText = completion.choices[0].message.content;
    const openaiResponse = JSON.parse(routeRecommendationText);

    // 응답 포맷 검증 및 변환
    let formattedResponse = {
        title: openaiResponse.title || '맞춤형 여행 일정',
        description: openaiResponse.description || `${startLocation}에서 ${endLocation}까지의 추천 여행 코스`,
        days: [],
    };

    // days 배열 확인 및 구조화
    if (Array.isArray(openaiResponse.days)) {
        formattedResponse.days = openaiResponse.days;
    } else {
        console.log('OpenAI 원본 응답 구조:', Object.keys(openaiResponse));
    }

    return formattedResponse;
}

// Gemini로 여행 경로 추천 받기
async function getGeminiRouteRecommendation(startLocation, endLocation, leisureType, experienceType, days) {
    try {
        // Gemini 2.0 Flash 모델 사용
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: {
                temperature: 0.4,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 2048,
            },
        });

        const prompt = `당신은 한국 여행 전문가로, 여행자의 선호도에 맞는 최적의 여행 일정과 경로를 추천해주는 역할을 합니다.
        
        출발지: ${startLocation}
        도착지: ${endLocation}
        여행 스타일: ${mapLeisureType(leisureType)}, ${mapExperienceType(experienceType)}
        여행 일수: ${days}일
        
        위 정보를 바탕으로 ${days}일 일정의 여행 경로를 추천해주세요. 각 일자별로 2~3개의 방문지를 추천하고, 각 장소마다 간략한 설명과 특징을 알려주세요.
        
        반드시 다음 JSON 형식으로 응답해주세요. 다른 텍스트나 설명은 포함하지 말고 JSON만 응답해주세요:
        {
          "title": "여행 제목",
          "description": "여행 설명",
          "days": [
            {
              "day": 1,
              "places": [
                {
                  "name": "장소명",
                  "description": "장소 설명",
                  "activity": "추천 활동",
                  "time": "방문 추천 시간"
                }
              ]
            }
          ]
        }`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // JSON 문자열 추출 및 파싱
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const geminiResponse = JSON.parse(jsonMatch[0]);

            // 응답 포맷 검증 및 변환
            let formattedResponse = {
                title: geminiResponse.title || '맞춤형 여행 일정',
                description: geminiResponse.description || `${startLocation}에서 ${endLocation}까지의 추천 여행 코스`,
                days: [],
            };

            if (Array.isArray(geminiResponse.days)) {
                formattedResponse.days = geminiResponse.days;
            }

            return formattedResponse;
        } else {
            throw new Error('Gemini 응답에서 JSON을 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('Gemini 여행 경로 추천 중 오류 발생:', error);
        // 오류 발생 시 빈 응답 반환
        return {
            title: '맞춤형 여행 일정',
            description: `${startLocation}에서 ${endLocation}까지의 추천 여행 코스`,
            days: [],
        };
    }
}

// 두 모델의 여행 경로 추천을 비교하고 공통된 장소만 반환
function compareAndCombineRouteRecommendations(openaiRecommendation, geminiRecommendation) {
    try {
        // 응답 형식 검증
        if (
            !openaiRecommendation.days ||
            !Array.isArray(openaiRecommendation.days) ||
            !geminiRecommendation.days ||
            !Array.isArray(geminiRecommendation.days)
        ) {
            return openaiRecommendation; // 형식이 맞지 않으면 OpenAI 결과 반환
        }

        const combinedRecommendation = {
            title: openaiRecommendation.title,
            description: openaiRecommendation.description,
            days: [],
        };

        // 각 일자별로 처리
        const maxDays = Math.min(openaiRecommendation.days.length, geminiRecommendation.days.length);

        for (let i = 0; i < maxDays; i++) {
            const openaiDay = openaiRecommendation.days[i];
            const geminiDay = geminiRecommendation.days[i];

            // places 배열이 없는 경우 체크
            if (
                !openaiDay.places ||
                !Array.isArray(openaiDay.places) ||
                !geminiDay.places ||
                !Array.isArray(geminiDay.places)
            ) {
                combinedRecommendation.days.push(openaiDay);
                continue;
            }

            // 장소 이름 비교
            const openaiPlaceNames = openaiDay.places.map((place) => place.name.toLowerCase());
            const geminiPlaceNames = geminiDay.places.map((place) => place.name.toLowerCase());

            // 공통 장소 이름 찾기 (부분 일치도 인정)
            const commonPlaceNames = openaiPlaceNames.filter((name) =>
                geminiPlaceNames.some((geminiName) => geminiName.includes(name) || name.includes(geminiName))
            );

            // 공통 장소만 필터링
            const commonPlaces = openaiDay.places.filter((place) =>
                commonPlaceNames.some(
                    (commonName) =>
                        place.name.toLowerCase().includes(commonName) || commonName.includes(place.name.toLowerCase())
                )
            );

            // 공통 장소가 없으면 OpenAI 결과 사용
            const dayPlaces = commonPlaces.length > 0 ? commonPlaces : openaiDay.places;

            combinedRecommendation.days.push({
                day: openaiDay.day,
                places: dayPlaces,
            });
        }

        return combinedRecommendation;
    } catch (error) {
        console.error('경로 추천 결과 비교 중 오류 발생:', error);
        // 오류 시 OpenAI 결과 반환
        return openaiRecommendation;
    }
}

// 주소 결과에서 의미 있는 지역명 추출
function extractLocationName(geocodeResult) {
    // 지역명을 추출하는 로직 (국가, 도시, 행정구역 등)
    if (geocodeResult.address_components) {
        // 지역명으로 사용할 수 있는 컴포넌트 유형 우선순위
        const typesPriority = [
            'sublocality_level_1', // 구/동
            'locality', // 시
            'administrative_area_level_2', // 군/구
            'administrative_area_level_1', // 도/광역시
        ];

        for (const type of typesPriority) {
            const component = geocodeResult.address_components.find((comp) => comp.types.includes(type));
            if (component) {
                return component.long_name;
            }
        }
    }

    // 적절한 컴포넌트를 찾지 못했을 경우 첫 번째 줄을 반환
    const addressParts = geocodeResult.formatted_address.split(',');
    return addressParts[0].trim();
}

// 여행 타입 매핑 함수
function mapLeisureType(type) {
    const types = {
        leisure: '휴양 중심',
        tourism: '관광 중심',
    };
    return types[type] || type;
}

function mapExperienceType(type) {
    const types = {
        food: '식도락 여행',
        experience: '경험 추구형 여행',
    };
    return types[type] || type;
}

module.exports = router;
