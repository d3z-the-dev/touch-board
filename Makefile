# Touch Board — build, install and packaging for the GNOME Shell extension.
# The installable extension lives in src/; everything else is dev tooling.

UUID := $(shell sed -n 's/.*"uuid"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' src/metadata.json)
SOURCE := src
DEST := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
DIST := dist

.PHONY: check lint install uninstall enable pack clean

check:
	npm run check

lint:
	npm run lint

# On Wayland a log out / log in is required for the shell to load the copy.
install:
	rm -rf "$(DEST)"
	mkdir -p "$(DEST)"
	cp -r "$(SOURCE)/." "$(DEST)/"
	glib-compile-schemas "$(DEST)/schemas"
	gsettings set org.gnome.shell disable-user-extensions false || true
	gnome-extensions enable "$(UUID)" 2>/dev/null || true
	@echo "Installed $(UUID). On Wayland, log out and back in to load it."

uninstall:
	gnome-extensions disable "$(UUID)" 2>/dev/null || true
	rm -rf "$(DEST)"

enable:
	gnome-extensions enable "$(UUID)"

# Delegates to scripts/pack.sh so local and CI builds are byte-for-byte identical.
pack:
	bash scripts/pack.sh

clean:
	rm -rf "$(DIST)" build
