const admin = require('../firebaseAdmin');

const authenticateFirebaseToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    console.log('인증 헤더 확인:', authHeader ? '헤더 있음' : '헤더 없음');

    // 헤더에 토큰이 없으면 401 에러 반환
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('인증 토큰이 제공되지 않았습니다');
        return res.status(401).json({ error: '토큰이 제공되지 않았습니다.' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    console.log('토큰 추출:', idToken ? `토큰 길이: ${idToken.length}` : '토큰 없음');

    try {
        // Firebase Admin으로 토큰 검증
        console.log('Firebase 토큰 검증 시도');
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log('토큰 검증 성공:', decodedToken.uid);

        // 성공 시 요청 객체에 유저 정보 저장
        req.firebaseUser = decodedToken;

        // 다음 미들웨어 또는 라우터로 진행
        next();
    } catch (error) {
        console.error('토큰 검증 실패:', error);
        // 에러 타입에 따른 다른 응답
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: '만료된 토큰입니다. 다시 로그인해주세요.' });
        } else if (error.code === 'auth/id-token-revoked') {
            return res.status(401).json({ error: '취소된 토큰입니다. 다시 로그인해주세요.' });
        } else if (error.code === 'auth/invalid-id-token') {
            return res.status(403).json({ error: '유효하지 않은 토큰 형식입니다.' });
        } else {
            return res.status(403).json({ error: '유효하지 않은 토큰입니다.', details: error.message });
        }
    }
};

module.exports = authenticateFirebaseToken;
