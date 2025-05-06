const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const OpenAI = require('openai');

// 환경 변수나 설정 파일에서 API 키를 가져와야 합니다.
// 아래 코드는 예시로, 실제 구현 시 보안을 위해 환경 변수를 사용하세요.
const GOOGLE_MAPS_API_KEY = 'AIzaSyC8fok9-HjSp65TrWrVLcD9eceD7ZerMo0'; // 실제 키로 교체 필요
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // 환경 변수에서 OpenAI API 키를 가져옵니다
});

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

        // 2. OpenAI API를 사용하여 주변 추천 장소 얻기
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo', // 또는 "gpt-4" 등 원하는 모델
            messages: [
                {
                    role: 'system',
                    content: '당신은 관광과 방문지에 대한 추천을 제공하는 한국 여행 전문가입니다.',
                },
                {
                    role: 'user',
                    content: `${
                        locationName || formattedAddress
                    } 주변에서 방문할만한 장소 5곳을 추천해주세요. 각 장소마다 간략한 설명과 특징을 알려주세요. JSON 형식으로 응답해주세요.`,
                },
            ],
            response_format: { type: 'json_object' },
        });

        // OpenAI 응답 파싱 (JSON 문자열을 객체로 변환)
        const recommendationsText = completion.choices[0].message.content;
        const recommendations = JSON.parse(recommendationsText);

        // 3. 응답 전송
        res.json({
            location: {
                latitude,
                longitude,
                address: formattedAddress,
                name: locationName,
            },
            recommendations,
        });
    } catch (error) {
        console.error('추천 요청 처리 중 오류 발생:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

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

        console.log('OpenAI API 호출 준비');
        // OpenAI API를 사용하여 여행 경로 추천 받기
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content:
                        '당신은 한국 여행 전문가로, 여행자의 선호도에 맞는 최적의 여행 일정과 경로를 추천해주는 역할을 합니다. 제공하는 정보는 정확하고 실용적이어야 합니다.',
                },
                {
                    role: 'user',
                    content: `출발지: ${finalStartLocation}
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

        console.log('OpenAI API 응답 받음');
        // OpenAI 응답 파싱
        const routeRecommendationText = completion.choices[0].message.content;
        const openaiResponse = JSON.parse(routeRecommendationText);

        // 응답 포맷 검증 및 변환
        let formattedResponse = {
            title: openaiResponse.title || '맞춤형 여행 일정',
            description: openaiResponse.description || `${finalStartLocation}에서 ${endLocation}까지의 추천 여행 코스`,
            days: [],
        };

        // days 배열 확인 및 구조화
        if (Array.isArray(openaiResponse.days)) {
            formattedResponse.days = openaiResponse.days;
        } else {
            // 다른 형식으로 왔을 경우 변환 로직 추가
            // 예: 일정1, 일정2, 일정3 형식인 경우
            console.log('OpenAI 원본 응답 구조:', Object.keys(openaiResponse));
        }

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
            routeRecommendation: formattedResponse,
        });
    } catch (error) {
        console.error('여행 경로 추천 중 오류 발생:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.', details: error.message });
    }
});

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
