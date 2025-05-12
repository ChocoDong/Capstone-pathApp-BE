const fs = require('fs');
const path = require('path');
const db = require('./db_connect');

// SQL 파일 읽기
const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

// SQL 명령어 분리 및 실행
const statements = schemaSQL.split(';').filter((statement) => statement.trim() !== '');

async function initializeDatabase() {
    console.log('데이터베이스 초기화 시작...');

    for (const statement of statements) {
        try {
            await db.promise().query(statement + ';');
            console.log('SQL 명령어 실행 성공');
        } catch (error) {
            console.error('SQL 실행 중 오류 발생:', error);
        }
    }

    console.log('데이터베이스 초기화 완료');
    db.end();
}

// 스크립트가 직접 실행된 경우에만 초기화 진행
if (require.main === module) {
    initializeDatabase().catch((err) => {
        console.error('데이터베이스 초기화 실패:', err);
        process.exit(1);
    });
}

module.exports = initializeDatabase;
