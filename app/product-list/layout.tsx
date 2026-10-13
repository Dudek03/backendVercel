export default function Layout({ children, recommended, modal }: { children: React.ReactNode, recommended: React.ReactNode, modal: React.ReactNode }) {
    return (
        <div className="flex flex-col md:flex-row gap-6 relative">
            <div className="w-full md:w-3/4">{children}</div>
            <aside className="w-full md:w-1/4 p-4 bg-gray-50 border-l">{recommended}</aside>
            {modal}
        </div>
    );
}
