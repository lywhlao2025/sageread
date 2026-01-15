type MenuItem = {
  id?: string;
  text?: string;
  action?: () => void;
};

export class Menu {
  private items: MenuItem[];

  constructor(items: MenuItem[]) {
    this.items = items;
  }

  static async new(options: { items: MenuItem[] }): Promise<Menu> {
    return new Menu(options.items);
  }

  async popup(): Promise<void> {
    return;
  }
}

export class MenuItem {
  constructor() {}
}

export class PredefinedMenuItem {
  constructor() {}
}
