// Xử lý để có thể upload được file
const multer = require("multer");
const { createFolderIfNotExist } = require("../helpers/utils.js");

// Use the operating system's temporary directory in hosted environments.
// Tạo sẵn folder:
createFolderIfNotExist("/tmp/images");
createFolderIfNotExist("/tmp/videos");

const storage = multer.diskStorage({
    // Định nghĩa nơi lưu trữ file
    destination: function (req, file, cb) {
        if (file.mimetype.startsWith("image/")) {
            // Nếu là file ảnh thì lưu vào thư mục /tmp/images/
            cb(null, "/tmp/images/");
        } else if (file.mimetype.startsWith("video/")) {
            // Nếu là file video thì lưu vào thư mục /tmp/videos/
            cb(null, "/tmp/videos/");
        } else {
            cb(new Error("Unsupported file type"));
        }
    },
    filename: function (req, file, cb) {
        // Thay đổi lại tên của file trước khi lưu
        cb(
            null,
            Date.now() +
                "-" +
                Math.round(Math.random() * 1e9) +
                "-" +
                file.originalname
        );
    },
});

const upload = multer({ storage: storage });
const handleUpload = (maxImageCount, maxVideoCount) => {
    return (req, res, next) => {
        // Nếu một trong các loại file vượt quá số lượng thì nó sẽ ngừng upload và trả về lỗi
        // Tại cùng 1 lúc chỉ có hoặc images hoặc videos bị lỗi vì nếu 1 trong 2 bị lỗi thì middleware sẽ dừng lại
        const middleware = upload.fields([
            { name: "thumbnail", maxCount: 1 },
            { name: "images", maxCount: maxImageCount },
            { name: "videos", maxCount: maxVideoCount },
        ]);
        middleware(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === "LIMIT_UNEXPECTED_FILE") {
                    return res.status(400).json({
                        error: `Too many ${err.field} to upload`,
                    });
                }
            }
            next();
        });
    };
};

module.exports = handleUpload;
