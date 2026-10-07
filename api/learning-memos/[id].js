import learningMemosHandler from '../learning-memos.js';

export default function handler(request, response) {
  request.memoId = request.query?.id;
  return learningMemosHandler(request, response);
}