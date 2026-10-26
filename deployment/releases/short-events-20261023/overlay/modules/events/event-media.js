"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyMedia = void 0;
exports.readEventMediaMap = readEventMediaMap;
exports.validateEventMedia = validateEventMedia;
exports.readEventMedia = readEventMedia;
exports.saveEventMedia = saveEventMedia;
exports.decodeEventImage = decodeEventImage;
exports.readEventImage = readEventImage;
const common_1 = require("@nestjs/common");
const database_1 = require("@ucell/database");
const emptyMedia = () => ({ images: [], videos: [] });
exports.emptyMedia = emptyMedia;
async function readEventMediaMap(db, ids) { if (!ids.length)
    return new Map(); const rows = await db.$queryRaw(database_1.Prisma.sql `SELECT member_event_version_id::text AS id,presentation FROM learning.member_event_version WHERE member_event_version_id IN (${database_1.Prisma.join(ids.map(id => database_1.Prisma.sql `${id}::uuid`))})`); return new Map(rows.map((r) => [r.id, r.presentation])); }
function validateEventMedia(value) {
    if (!value || !Array.isArray(value.images) || !Array.isArray(value.videos) || value.images.length > 8 || value.videos.length > 5)
        throw new common_1.BadRequestException('EVENT_MEDIA_INVALID');
    if (value.images.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))
        throw new common_1.BadRequestException('EVENT_IMAGE_INVALID');
    for (const text of value.videos) {
        try {
            const u = new URL(text);
            if (text.length > 2000 || u.protocol !== 'https:' || u.username || u.password)
                throw 0;
        }
        catch {
            throw new common_1.BadRequestException('EVENT_VIDEO_URL_INVALID');
        }
    }
    return { images: [...new Set(value.images)], videos: [...new Set(value.videos)] };
}
async function readEventMedia(db, id) { const rows = await db.$queryRaw `SELECT presentation FROM learning.member_event_version WHERE member_event_version_id=${id}::uuid`; return rows[0]?.presentation ?? (0, exports.emptyMedia)(); }
async function saveEventMedia(db, id, media) { for (const image of media.images) {
    const rows = await db.$queryRaw `SELECT image_id FROM learning.event_image WHERE image_id=${image}::uuid`;
    if (!rows.length)
        throw new common_1.BadRequestException('EVENT_IMAGE_NOT_FOUND');
} await db.$executeRaw `UPDATE learning.member_event_version SET presentation=${JSON.stringify(media)}::jsonb WHERE member_event_version_id=${id}::uuid`; }
function decodeEventImage(mime, content) {
    if (typeof content !== 'string' || content.length > 699052 || !/^[A-Za-z0-9+/]+={0,2}$/.test(content))
        throw new common_1.BadRequestException('EVENT_IMAGE_SIZE_OR_ENCODING_INVALID');
    const b = Buffer.from(content, 'base64');
    if (b.length < 12 || b.length > 524288 || b.toString('base64') !== content)
        throw new common_1.BadRequestException('EVENT_IMAGE_SIZE_OR_ENCODING_INVALID');
    const valid = mime === 'image/jpeg' ? b[0] === 255 && b[1] === 216 && b[2] === 255 : mime === 'image/png' ? b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : mime === 'image/webp' ? b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' : false;
    if (!valid)
        throw new common_1.BadRequestException('EVENT_IMAGE_FORMAT_INVALID');
    return b;
}
async function readEventImage(db, id, isAdmin = false) {
    if (!/^[0-9a-f-]{36}$/i.test(id))
        throw new common_1.NotFoundException('EVENT_IMAGE_NOT_FOUND');
    const rows = await db.$queryRaw `SELECT i.mime_type,i.content FROM learning.event_image i WHERE i.image_id=${id}::uuid AND (${isAdmin} OR EXISTS(SELECT 1 FROM learning.member_event_version v JOIN learning.member_event e ON e.member_event_id=v.member_event_id WHERE e.status='PUBLISHED' AND v.status='PUBLISHED' AND v.presentation->'images' @> ${JSON.stringify([id])}::jsonb))`;
    if (!rows.length)
        throw new common_1.NotFoundException('EVENT_IMAGE_NOT_FOUND');
    return rows[0];
}
//# sourceMappingURL=event-media.js.map