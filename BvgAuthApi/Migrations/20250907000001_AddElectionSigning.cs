using System;
using Microsoft.EntityFrameworkCore.Migrations;

namespace BvgAuthApi.Migrations
{
    public partial class AddElectionSigning : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "SigningRequired",
                table: "Elections",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SigningProfile",
                table: "Elections",
                type: "text",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SigningRequired",
                table: "Elections");

            migrationBuilder.DropColumn(
                name: "SigningProfile",
                table: "Elections");
        }
    }
}

