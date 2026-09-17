import SwiftUI

enum TrulyTheme {
    static let canvas = Color(red: 0.969, green: 0.969, blue: 0.969)
    static let surface = Color.white
    static let ink = Color(red: 0.102, green: 0.110, blue: 0.118)
    static let text = Color(red: 0.275, green: 0.294, blue: 0.314)
    static let muted = Color(red: 0.424, green: 0.447, blue: 0.471)
    static let border = Color(red: 0.855, green: 0.886, blue: 0.890)
    static let teal = Color(red: 0.078, green: 0.478, blue: 0.463)
    static let tealDark = Color(red: 0.059, green: 0.384, blue: 0.373)
    static let tealSoft = Color(red: 0.914, green: 0.961, blue: 0.969)
    static let tealPale = Color(red: 0.953, green: 0.984, blue: 0.984)
}

struct TrulyBrandMark: View {
    var size: CGFloat = 28

    var body: some View {
        ZStack(alignment: .topTrailing) {
            RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                .fill(TrulyTheme.teal)

            Circle()
                .stroke(Color.white.opacity(0.9), lineWidth: max(1.5, size * 0.07))
                .frame(width: size * 0.46, height: size * 0.46)
                .position(x: size * 0.48, y: size * 0.53)

            Circle()
                .fill(Color.white)
                .frame(width: size * 0.16, height: size * 0.16)
                .padding(size * 0.17)
        }
        .frame(width: size, height: size)
        .shadow(color: TrulyTheme.teal.opacity(0.14), radius: 7, y: 3)
        .accessibilityHidden(true)
    }
}

struct TrulyCompanionOrb: View {
    var size: CGFloat = 34
    var isActive = false

    var body: some View {
        ZStack {
            Circle()
                .fill(TrulyTheme.teal.opacity(isActive ? 0.17 : 0.09))
                .frame(width: size * 1.55, height: size * 1.55)

            Circle()
                .fill(
                    RadialGradient(
                        colors: [.white, Color(red: 0.459, green: 0.773, blue: 0.757), TrulyTheme.tealDark],
                        center: UnitPoint(x: 0.34, y: 0.28),
                        startRadius: 1,
                        endRadius: size * 0.62
                    )
                )
                .overlay {
                    Circle()
                        .stroke(Color.white.opacity(0.7), lineWidth: 1)
                }
                .frame(width: size, height: size)

            Circle()
                .stroke(Color.white.opacity(0.88), lineWidth: 1.5)
                .frame(width: size * 0.26, height: size * 0.26)
        }
        .shadow(color: TrulyTheme.teal.opacity(isActive ? 0.4 : 0.24), radius: isActive ? 16 : 9)
        .accessibilityLabel(isActive ? "Truly is working" : "Truly companion")
    }
}

struct TrulyPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .frame(minHeight: 40)
            .background(
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(configuration.isPressed ? TrulyTheme.tealDark : TrulyTheme.teal)
            )
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
    }
}

struct TrulyCompactPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .frame(minWidth: 62, minHeight: 34)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(configuration.isPressed ? TrulyTheme.tealDark : TrulyTheme.teal)
            )
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
    }
}

struct TrulySecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(TrulyTheme.ink)
            .padding(.horizontal, 13)
            .frame(minHeight: 34)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(configuration.isPressed ? TrulyTheme.tealSoft : TrulyTheme.surface)
                    .overlay {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(TrulyTheme.border, lineWidth: 1)
                    }
            )
    }
}

extension View {
    func trulyPointingCursor() -> some View {
        onHover { isHovering in
            if isHovering {
                NSCursor.pointingHand.set()
            } else {
                NSCursor.arrow.set()
            }
        }
    }
}
