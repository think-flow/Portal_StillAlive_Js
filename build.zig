const std = @import("std");
const step = @import("step/");

const static_dir = "static";

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "portal_still_alive",
        .root_source_file = b.path("main.zig"),
        .optimize = optimize,
        .target = target,
    });

    // zig server need link this lib in windows
    if (target.result.os.tag == .windows) {
        exe.linkSystemLibrary("ws2_32");
    }

    embedStaticDir(b, exe, target, optimize) catch |err| {
        std.log.err("Problem adding static: {!}", .{err});
    };

    b.installArtifact(exe);

    // This creates a top level step. Top level steps have a name and can be
    // invoked by name when running `zig build` (e.g. `zig build run`).
    // This will evaluate the `run` step rather than the default step.
    // For a top level step to actually do something, it must depend on other
    // steps (e.g. a Run step, as we will see in a moment).
    const run_step = b.step("run", "Run the app");

    // This creates a RunArtifact step in the build graph. A RunArtifact step
    // invokes an executable compiled by Zig. Steps will only be executed by the
    // runner if invoked directly by the user (in the case of top level steps)
    // or if another step depends on it, so it's up to you to define when and
    // how this Run step will be executed. In our case we want to run it when
    // the user runs `zig build run`, so we create a dependency link.
    const run_cmd = b.addRunArtifact(exe);
    run_step.dependOn(&run_cmd.step);

    // By making the run step depend on the default step, it will be run from the
    // installation directory rather than directly from within the cache directory.
    run_cmd.step.dependOn(b.getInstallStep());

    // This allows the user to pass arguments to the application in the build
    // command itself, like this: `zig build run -- arg1 arg2 etc`
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }
}

fn embedStaticDir(
    b: *std.Build,
    exe: *std.Build.Step.Compile,
    target: anytype,
    optimize: anytype,
) !void {
    var options = b.addOptions();
    var files = std.ArrayList([]const u8).init(b.allocator);
    defer files.deinit();

    var buf: [std.fs.max_path_bytes]u8 = undefined;
    const path = try std.fs.cwd().realpath("static", buf[0..]);

    const dir = try std.fs.openDirAbsolute(path, .{ .iterate = true });

    try collectFiles(dir, b.allocator, "", &files);

    options.addOption([]const []const u8, "files", files.items);
    exe.step.dependOn(&options.step);

    const assets = b.addModule("assets", .{
        .root_source_file = options.getOutput(),
        .target = target,
        .optimize = optimize,
    });

    exe.root_module.addImport("assets", assets);
}

fn collectFiles(
    dir: std.fs.Dir,
    allocator: std.mem.Allocator,
    parent_path: []const u8,
    files: *std.ArrayList([]const u8),
) !void {
    var iter = dir.iterate();
    while (try iter.next()) |entry| {
        const full_path = try std.fs.path.join(allocator, &.{ parent_path, entry.name });
        defer allocator.free(full_path);

        if (entry.kind == .directory) {
            // 排除unpackage文件夹
            if (std.mem.eql(u8, entry.name, "unpackage")) {
                continue;
            }
            //递归
            var subdir = try dir.openDir(entry.name, .{ .iterate = true });
            defer subdir.close();
            try collectFiles(subdir, allocator, full_path, files);
        }

        if (entry.kind != .file) {
            continue;
        }
        // 排除manifest.json文件
        if (std.mem.eql(u8, entry.name, "manifest.json")) {
            continue;
        }

        try files.append(try allocator.dupe(u8, full_path));
    }
}
