import Foundation
import UIKit

enum OdoLogGroup {
    static let avatarName = "avatar.jpg"
    static let dashboardWidgetsKey = "odolog.dashboardWidgets"
}

enum ProfilePhoto {
    static var fileURL: URL? {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?
            .appendingPathComponent(OdoLogGroup.avatarName)
    }

    static func image() -> UIImage? {
        guard let url = fileURL, let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }

    static func save(_ data: Data) throws {
        guard let image = UIImage(data: data) else { throw OdoLogError.notFound }
        let square = image.preparedForAvatar(size: 512)
        guard let jpeg = square.jpegData(compressionQuality: 0.86) else { throw OdoLogError.notFound }
        guard let url = fileURL else { throw OdoLogError.notFound }
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try jpeg.write(to: url, options: .atomic)
    }

    static func remove() {
        if let url = fileURL { try? FileManager.default.removeItem(at: url) }
    }
}

extension UIImage {
    func preparedForAvatar(size: CGFloat) -> UIImage {
        let side = min(self.size.width, self.size.height)
        let origin = CGPoint(x: (self.size.width - side) / 2, y: (self.size.height - side) / 2)
        let cropped = CGRect(origin: origin, size: CGSize(width: side, height: side))
        guard let cg = cgImage?.cropping(to: cropped) else { return self }
        let croppedImage = UIImage(cgImage: cg, scale: scale, orientation: imageOrientation)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: CGSize(width: size, height: size), format: format).image { _ in
            croppedImage.draw(in: CGRect(origin: .zero, size: CGSize(width: size, height: size)))
        }
    }
}
