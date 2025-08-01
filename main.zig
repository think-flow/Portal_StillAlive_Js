// 将static文件夹进行打包
// 并提供基础的静态文件服务器
// 这样就可以直接打开浏览器播放still-alive了

const std = @import("std");
const assets = @import("assets");
const Header = std.http.Header;

// kv pair type used to fill ComptimeStringMap
const EmbeddedAsset = struct {
    []const u8,
    []const u8,
};

// declare a StaticStringMap and fill it with our filenames and data
// js\core.js
// js\xterm\xterm.js
// css\style.css
const embeddedFilesMap = std.StaticStringMap([]const u8).initComptime(genMap());

fn genMap() [assets.files.len]EmbeddedAsset {
    var embassets: [assets.files.len]EmbeddedAsset = undefined;
    comptime var i = 0;
    inline for (assets.files) |file| {
        embassets[i][0] = file;
        embassets[i][1] = @embedFile("static/" ++ file);
        i += 1;
    }
    return embassets;
}

const ports = [_]u16{
    8080,  3003,  4000,  5005,  6006,  7070,
    8081,  8888,  9091,  10000, 12000, 15000,
    18080, 20000, 21000, 25000, 27000, 30000,
    35000, 40000, 45000,
};

pub fn main() !void {
    // 如果是 Windows，设置控制台编码为 UTF-8
    if (@import("builtin").os.tag == .windows) {
        _ = std.os.windows.kernel32.SetConsoleOutputCP(65001);
    }

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    for (ports) |port| {
        const address = try std.net.Address.parseIp4("127.0.0.1", port);
        var server = address.listen(std.net.Address.ListenOptions{}) catch |err| {
            if (err == error.AddressInUse) {
                //如果端口被占用，则挑选新的端口
                continue;
            }
            return err;
        };

        printLn("Server listen on http://{}", .{address});
        printLn("Press ctrl+c to exit", .{});
        printLn("visited this address to play still-alive", .{});
        while (true) {
            try handleConnection(try server.accept(), allocator);
        }

        break;
    }
}

fn handleConnection(conn: std.net.Server.Connection, allocator: anytype) !void {
    defer conn.stream.close();

    var buffer: [1024]u8 = undefined;
    var http_server = std.http.Server.init(conn, &buffer);
    var req = try http_server.receiveHead();
    var request_path = req.head.target;

    // printLn("{s}", .{req.head.target});

    // 处理 根路径 "/"
    if (std.mem.eql(u8, request_path, "/")) {
        request_path = "/index.html";
    }

    // 处理其他路径
    //去掉 开头的 '/'' 并将其余'/' 替换为 '\'
    const file_path = try replaceSlash(request_path[1..], allocator);

    const mybe_data = embeddedFilesMap.get(file_path);
    if (mybe_data == null) {
        // 未找到文件
        // 返回404
        try req.respond("404 Not Found", .{
            .status = .not_found,
            .version = .@"HTTP/1.1",
            .keep_alive = true,
        });
        return;
    }
    const data = mybe_data.?;

    if (std.mem.endsWith(u8, file_path, ".css")) {
        try response(&req, data, &[_]Header{
            Header{ .name = "Content-Type", .value = "text/css; charset=utf-8" },
        });
        return;
    }

    if (std.mem.endsWith(u8, file_path, ".js")) {
        try response(&req, data, &[_]Header{
            Header{ .name = "Content-Type", .value = "application/javascript" },
        });
        return;
    }

    if (std.mem.endsWith(u8, file_path, ".html")) {
        try response(&req, data, &[_]Header{
            Header{ .name = "Content-Type", .value = "text/html; charset=utf-8" },
        });
        return;
    }

    if (std.mem.endsWith(u8, file_path, ".mp3")) {
        try response(&req, data, &[_]Header{
            Header{ .name = "Content-Type", .value = "audio/mpeg" },
        });
        return;
    }

    //支持ttf字体文件下载
    if (std.mem.endsWith(u8, file_path, ".ttf")) {
        try response(&req, data, &[_]Header{
            Header{ .name = "Content-Type", .value = "font/ttf" },
            Header{ .name = "Cache-Control", .value = "max-age=31536000" },
        });
        return;
    }

    try req.respond("not support this file", .{
        .status = .not_implemented,
        .version = .@"HTTP/1.1",
        .keep_alive = true,
    });
}

pub fn print(comptime fmt: []const u8, args: anytype) void {
    var out = std.io.getStdOut().writer();
    out.print(fmt, args) catch |err| {
        @panic(@errorName(err));
    };
}

pub fn printLn(comptime fmt: []const u8, args: anytype) void {
    print(fmt ++ "\n", args);
}

fn replaceSlash(input: []const u8, allocator: anytype) ![]const u8 {
    var result = std.ArrayList(u8).init(allocator);
    defer result.deinit();

    for (input) |char| {
        try result.append(if (char == '/') '\\' else char);
    }
    return result.toOwnedSlice(); // 返回新字符串（需调用方释放内存）
}

fn response(
    req: *std.http.Server.Request,
    content: []const u8,
    headers: ?[]const std.http.Header,
) !void {
    try req.respond(content, .{
        .status = .ok,
        .keep_alive = true,
        .version = .@"HTTP/1.1",
        .extra_headers = if (headers == null) &[_]std.http.Header{} else headers.?,
    });
}
