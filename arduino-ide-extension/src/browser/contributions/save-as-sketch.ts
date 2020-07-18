import { injectable } from 'inversify';
import { remote } from 'electron';
import * as dateFormat from 'dateformat';
import { ArduinoMenus } from '../menu/arduino-menus';
import { SketchContribution, URI, Command, CommandRegistry, MenuModelRegistry, KeybindingRegistry } from './contribution';

@injectable()
export class SaveAsSketch extends SketchContribution {

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(SaveAsSketch.Commands.SAVE_AS_SKETCH, {
            execute: args => this.saveAs(args)
        });
    }

    registerMenus(registry: MenuModelRegistry): void {
        registry.registerMenuAction(ArduinoMenus.FILE__SKETCH_GROUP, {
            commandId: SaveAsSketch.Commands.SAVE_AS_SKETCH.id,
            label: 'Save As...',
            order: '7'
        });
    }

    registerKeybindings(registry: KeybindingRegistry): void {
        registry.registerKeybinding({
            command: SaveAsSketch.Commands.SAVE_AS_SKETCH.id,
            keybinding: 'CtrlCmd+Shift+S'
        });
    }

    /**
     * Resolves `true` if the sketch was successfully saved as something.
     */
    async saveAs({ execOnlyIfTemp, openAfterMove }: SaveAsSketch.Options = SaveAsSketch.Options.DEFAULT): Promise<boolean> {
        const sketch = await this.currentSketch();
        if (!sketch) {
            return false;
        }

        const isTemp = await this.sketchService.isTemp(sketch);
        if (!isTemp && !!execOnlyIfTemp) {
            return false;
        }

        // If target does not exist, propose a `directories.user`/${sketch.name} path
        // If target exists, propose `directories.user`/${sketch.name}_copy_${yyyymmddHHMMss}
        const sketchDirUri = new URI((await this.configService.getConfiguration()).sketchDirUri);
        const exists = await this.fileSystem.exists(sketchDirUri.resolve(sketch.name).toString());
        const defaultUri = exists
            ? sketchDirUri.resolve(sketchDirUri.resolve(`${sketch.name}_copy_${dateFormat(new Date(), 'yyyymmddHHMMss')}`).toString())
            : sketchDirUri.resolve(sketch.name);
        const defaultPath = await this.fileSystem.getFsPath(defaultUri.toString())!;
        const { filePath, canceled } = await remote.dialog.showSaveDialog({ title: 'Save sketch folder as...', defaultPath });
        if (!filePath || canceled) {
            return false;
        }
        const destinationUri = await this.fileSystemExt.getUri(filePath);
        if (!destinationUri) {
            return false;
        }
        const workspaceUri = await this.sketchService.copy(sketch, { destinationUri });
        if (workspaceUri && openAfterMove) {
            this.workspaceService.open(new URI(workspaceUri));
        }
        return !!workspaceUri;
    }

}

export namespace SaveAsSketch {
    export namespace Commands {
        export const SAVE_AS_SKETCH: Command = {
            id: 'arduino-save-as-sketch'
        };
    }
    export interface Options {
        readonly execOnlyIfTemp?: boolean;
        readonly openAfterMove?: boolean;
    }
    export namespace Options {
        export const DEFAULT: Options = {
            execOnlyIfTemp: false,
            openAfterMove: true
        };
    }
}
