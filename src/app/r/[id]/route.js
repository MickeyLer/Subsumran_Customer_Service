import { NextResponse } from 'next/server';

/**
 * Short Redirect Endpoint
 * GET /r/[id] -> Redirects to /ReviewRegister?id=[id]
 * ให้ความยาวของลิงก์ในข้อความ LINE สั้นลงสูงสุด (ลดจาก 250+ ตัวอักษรเหลือประมาณ 35-45 ตัวอักษร)
 */
export async function GET(request, { params }) {
  const { id } = params;
  const url = new URL(request.url);
  const reviewUrl = new URL(`/ReviewRegister?id=${id}`, url.origin);

  return NextResponse.redirect(reviewUrl, { status: 307 });
}
