const express = require('express');
const router = express.Router();
const placeRepository = require('../database/placeRepository');

/**
 * 장소 ID로 리뷰 목록 조회
 */
router.get('/:placeId', async (req, res) => {
    try {
        const { placeId } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        // 장소 존재 여부 확인
        const place = await placeRepository.getPlaceByPlaceId(placeId);

        if (!place) {
            return res.status(404).json({
                success: false,
                error: '장소를 찾을 수 없습니다.',
            });
        }

        // 리뷰 조회
        const reviews = await placeRepository.getReviewsByPlaceId(placeId, limit, offset);

        res.json({
            success: true,
            placeId,
            placeName: place.name,
            totalReviews: reviews.length,
            reviews,
        });
    } catch (error) {
        console.error('리뷰 조회 중 오류 발생:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다.',
        });
    }
});

/**
 * 새 리뷰 작성
 */
router.post('/', async (req, res) => {
    try {
        const { placeId, placeName, userName, rating, comment } = req.body;

        // 필수 필드 검증
        if (!placeId || !placeName || !userName || !rating) {
            return res.status(400).json({
                success: false,
                error: '필수 입력 필드가 누락되었습니다.',
            });
        }

        // 장소 존재 여부 확인
        const place = await placeRepository.getPlaceByPlaceId(placeId);

        if (!place) {
            // 장소가 데이터베이스에 없으면 새로 생성
            await placeRepository.savePlace({
                place_id: placeId,
                name: placeName,
            });
        }

        // 리뷰 작성 날짜 설정
        const reviewDate = new Date().toISOString().split('T')[0];

        // 리뷰 저장
        const result = await placeRepository.saveReview({
            place_id: placeId,
            place_name: placeName,
            user_name: userName,
            rating: rating,
            comment: comment || null,
            review_date: reviewDate,
            source: 'user',
        });

        // 평균 평점 업데이트
        const reviews = await placeRepository.getReviewsByPlaceId(placeId);
        if (reviews.length > 0) {
            const totalRating = reviews.reduce((sum, review) => sum + parseFloat(review.rating), 0);
            const averageRating = totalRating / reviews.length;

            await placeRepository.savePlace({
                place_id: placeId,
                name: placeName,
                average_rating: averageRating,
            });
        }

        res.status(201).json({
            success: true,
            message: '리뷰가 성공적으로 작성되었습니다.',
            reviewId: result.insertId,
            placeId,
            placeName,
            userName,
            rating,
            comment,
            reviewDate,
        });
    } catch (error) {
        console.error('리뷰 작성 중 오류 발생:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다.',
        });
    }
});

/**
 * 리뷰 삭제
 */
router.delete('/:reviewId', async (req, res) => {
    try {
        const { reviewId } = req.params;

        // 리뷰 존재 여부 확인 (생략 - 실제 구현시 필요)

        // 리뷰 삭제 로직 (실제 삭제 구현 필요)
        res.json({
            success: true,
            message: '리뷰가 성공적으로 삭제되었습니다.',
        });
    } catch (error) {
        console.error('리뷰 삭제 중 오류 발생:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다.',
        });
    }
});

module.exports = router;
